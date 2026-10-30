-- ============================================================
-- MIGRATION: Fitur Tindak Lanjut (Laporan Harian RM)
--
-- Project  : Laporan Harian RM (BRI KCP Iskandar)
-- Target   : Supabase -> SQL Editor
--
-- SIFAT MIGRATION INI
--   * Idempotent  : aman dijalankan berulang kali.
--   * Non-destruktif: tidak ada DROP TABLE, tidak ada RESET,
--     tidak ada perubahan / penggantian id data lama.
--   * Aditif      : hanya menambah kolom & tabel baru.
--
-- RINGKASAN PERUBAHAN
--   1. laporan_rm.follow_up_status  -> status tindak lanjut per laporan
--                                      ('pending' = perlu ditindaklanjuti,
--                                       'done'    = selesai)
--   2. laporan_rm.tindak_lanjut_id  -> laporan lanjutan menunjuk ke tugas
--   3. tabel tindak_lanjut          -> satu baris = satu tugas
--   4. tabel tindak_lanjut_riwayat  -> jejak audit perubahan tugas
--   5. RLS: RM hanya akses miliknya, Admin sesuai role yang sudah ada
--
-- CATATAN PENTING
--   * Nomor rekening / NIK TIDAK dipakai sebagai primary key.
--     Identitas tugas = kolom id (uuid). customer_identity hanya
--     atribut untuk pencocokan kandidat, bukan identitas unik tugas.
--   * Fungsi public.current_user_is_admin() sudah dipakai aplikasi
--     (lihat supabase/role-access.sql). Diulang di sini dengan
--     CREATE OR REPLACE agar migration tetap aman bila dijalankan
--     pada project yang belum memiliki fungsi tersebut.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0) Prasyarat: helper role admin (dipakai policy RLS)
-- ------------------------------------------------------------
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) = 'admin'
  );
$$;

grant execute on function public.current_user_is_admin() to authenticated;

-- ------------------------------------------------------------
-- 1) Kolom baru pada laporan_rm
-- ------------------------------------------------------------
alter table public.laporan_rm
  add column if not exists follow_up_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'laporan_rm_follow_up_status_check'
  ) then
    alter table public.laporan_rm
      add constraint laporan_rm_follow_up_status_check
      check (follow_up_status in ('pending', 'done'));
  end if;
end;
$$;

create index if not exists laporan_rm_follow_up_status_idx
  on public.laporan_rm (follow_up_status);

-- ------------------------------------------------------------
-- 2) Tabel tugas tindak lanjut
-- ------------------------------------------------------------
create table if not exists public.tindak_lanjut (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  user_name         text,
  form_type         text not null default 'rmft',
  customer_name     text not null,
  customer_identity text,
  customer_type     text,
  phone             text,
  activity          text,
  status            text not null default 'pending',
  note              text,
  source_report_id  uuid references public.laporan_rm (id) on delete set null,
  last_report_id    uuid references public.laporan_rm (id) on delete set null,
  last_report_at    timestamptz not null default now(),
  closed_at         timestamptz,
  closed_by         uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tindak_lanjut_status_check check (status in ('pending', 'done')),
  constraint tindak_lanjut_form_type_check check (form_type in ('rmft', 'rmkredit'))
);

-- Satu laporan sumber hanya boleh melahirkan satu tugas
-- (mencegah tugas duplikat akibat submit berulang).
create unique index if not exists tindak_lanjut_source_report_key
  on public.tindak_lanjut (source_report_id)
  where source_report_id is not null;

create index if not exists tindak_lanjut_owner_status_idx
  on public.tindak_lanjut (user_id, status, last_report_at desc);

create index if not exists tindak_lanjut_identity_idx
  on public.tindak_lanjut (customer_identity);

-- ------------------------------------------------------------
-- 3) Relasi laporan lanjutan -> tugas
-- ------------------------------------------------------------
alter table public.laporan_rm
  add column if not exists tindak_lanjut_id uuid
  references public.tindak_lanjut (id) on delete set null;

create index if not exists laporan_rm_tindak_lanjut_idx
  on public.laporan_rm (tindak_lanjut_id);

-- ------------------------------------------------------------
-- 4) Riwayat / jejak audit tugas
-- ------------------------------------------------------------
create table if not exists public.tindak_lanjut_riwayat (
  id               uuid primary key default gen_random_uuid(),
  tindak_lanjut_id uuid not null references public.tindak_lanjut (id) on delete cascade,
  report_id        uuid references public.laporan_rm (id) on delete set null,
  user_id          uuid references public.profiles (id) on delete set null,
  user_name        text,
  action           text not null,
  status_before    text,
  status_after     text,
  note             text,
  created_at       timestamptz not null default now(),
  constraint tindak_lanjut_riwayat_action_check
    check (action in ('created', 'updated', 'closed', 'reopened', 'linked')),
  constraint tindak_lanjut_riwayat_status_check
    check (
      (status_before is null or status_before in ('pending', 'done'))
      and (status_after is null or status_after in ('pending', 'done'))
    )
);

create index if not exists tindak_lanjut_riwayat_task_idx
  on public.tindak_lanjut_riwayat (tindak_lanjut_id, created_at desc);

create index if not exists tindak_lanjut_riwayat_report_idx
  on public.tindak_lanjut_riwayat (report_id);

-- ------------------------------------------------------------
-- 5) updated_at otomatis
-- ------------------------------------------------------------
create or replace function public.tindak_lanjut_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tindak_lanjut_touch_updated_at on public.tindak_lanjut;
create trigger tindak_lanjut_touch_updated_at
before update on public.tindak_lanjut
for each row execute function public.tindak_lanjut_touch_updated_at();

-- ------------------------------------------------------------
-- 6) Row Level Security
--    Keamanan dijaga di database, bukan hanya filter frontend.
-- ------------------------------------------------------------
alter table public.tindak_lanjut enable row level security;
alter table public.tindak_lanjut_riwayat enable row level security;

drop policy if exists "tindak_lanjut_select_own_or_admin" on public.tindak_lanjut;
create policy "tindak_lanjut_select_own_or_admin"
on public.tindak_lanjut for select to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "tindak_lanjut_insert_own" on public.tindak_lanjut;
create policy "tindak_lanjut_insert_own"
on public.tindak_lanjut for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "tindak_lanjut_update_own_or_admin" on public.tindak_lanjut;
create policy "tindak_lanjut_update_own_or_admin"
on public.tindak_lanjut for update to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "tindak_lanjut_delete_own_or_admin" on public.tindak_lanjut;
create policy "tindak_lanjut_delete_own_or_admin"
on public.tindak_lanjut for delete to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "tindak_lanjut_riwayat_select_own_or_admin" on public.tindak_lanjut_riwayat;
create policy "tindak_lanjut_riwayat_select_own_or_admin"
on public.tindak_lanjut_riwayat for select to authenticated
using (
  exists (
    select 1
    from public.tindak_lanjut t
    where t.id = tindak_lanjut_riwayat.tindak_lanjut_id
      and (t.user_id = auth.uid() or public.current_user_is_admin())
  )
);

drop policy if exists "tindak_lanjut_riwayat_insert_own_or_admin" on public.tindak_lanjut_riwayat;
create policy "tindak_lanjut_riwayat_insert_own_or_admin"
on public.tindak_lanjut_riwayat for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.tindak_lanjut t
    where t.id = tindak_lanjut_riwayat.tindak_lanjut_id
      and (t.user_id = auth.uid() or public.current_user_is_admin())
  )
);

-- ------------------------------------------------------------
-- 7) Hak akses tabel (RLS tetap yang menentukan baris mana)
-- ------------------------------------------------------------
grant select, insert, update, delete on public.tindak_lanjut to authenticated;
grant select, insert on public.tindak_lanjut_riwayat to authenticated;

commit;

-- ============================================================
-- VERIFIKASI SETELAH MIGRATION (jalankan manual, read-only)
-- ============================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'laporan_rm'
-- order by ordinal_position;
--
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public' and tablename like 'tindak_lanjut%'
-- order by tablename, policyname;
-- ============================================================
