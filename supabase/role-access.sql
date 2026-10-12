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

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.current_user_is_admin() then
    if tg_op = 'INSERT' then
      new.role := 'Pegawai';
    else
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before insert or update of role on public.profiles
for each row execute function public.protect_profile_role();

alter table public.laporan_rm
add column if not exists user_name text;

alter table public.profiles enable row level security;
alter table public.laporan_rm enable row level security;
alter table public.aktivitas_log enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'laporan_rm', 'aktivitas_log')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end;
$$;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles for update to authenticated
using (id = auth.uid() or public.current_user_is_admin())
with check (id = auth.uid() or public.current_user_is_admin());

drop policy if exists "laporan_rm_select_authenticated" on public.laporan_rm;
create policy "laporan_rm_select_authenticated"
on public.laporan_rm for select to authenticated
using (true);

drop policy if exists "laporan_rm_insert_own" on public.laporan_rm;
create policy "laporan_rm_insert_own"
on public.laporan_rm for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "laporan_rm_update_own_or_admin" on public.laporan_rm;
create policy "laporan_rm_update_own_or_admin"
on public.laporan_rm for update to authenticated
using (user_id = auth.uid() or public.current_user_is_admin())
with check (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "laporan_rm_delete_own_or_admin" on public.laporan_rm;
create policy "laporan_rm_delete_own_or_admin"
on public.laporan_rm for delete to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "aktivitas_log_select_own_or_admin" on public.aktivitas_log;
create policy "aktivitas_log_select_own_or_admin"
on public.aktivitas_log for select to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "aktivitas_log_insert_own" on public.aktivitas_log;
create policy "aktivitas_log_insert_own"
on public.aktivitas_log for insert to authenticated
with check (user_id = auth.uid());

grant execute on function public.current_user_is_admin() to authenticated;
