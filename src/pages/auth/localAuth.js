import { supabase } from '../../config/supabaseClient.js';

const USERS_STORAGE_KEY = 'bri-app-users-v1';
const SESSION_STORAGE_KEY = 'bri-app-session-v1';
const PASSWORD_HASH_ITERATIONS = 120000;

function readUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveLocalUser(user) {
  const users = readUsers();
  const filtered = users.filter((u) => u.email !== user.email && u.id !== user.id);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([...filtered, user]));
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function hashPassword(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Browser ini tidak mendukung penyimpanan password yang aman.');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(salt),
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );

  return bytesToBase64(new Uint8Array(hash));
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobTitle: user.jobTitle || user.job_title || 'Relationship Manager',
    role: user.role || 'Admin',
    photo: user.photo || user.photo_url || '',
  };
}

export async function registerUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Coba registrasi ke Supabase Auth
  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name: name.trim() },
      },
    });

    if (error) {
      if (error.message?.toLowerCase().includes('already registered')) {
        throw new Error('Email ini sudah terdaftar di Supabase. Silakan masuk.');
      }
      if (error.message?.toLowerCase().includes('rate limit')) {
        throw new Error(
          'Batas pengiriman email Supabase tercapai (email rate limit). Mohon matikan opsi "Confirm email" di dashboard Supabase agar pendaftaran bisa langsung berhasil tanpa verifikasi email.',
        );
      }
      throw error;
    }

    if (data?.user) {
      const userObj = {
        id: data.user.id,
        name: name.trim(),
        email: normalizedEmail,
        jobTitle: 'Relationship Manager',
        role: 'Admin',
        photo: '',
      };

      // Pastikan baris di tabel public.profiles dibuat/disinkronkan
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name: name.trim(),
          email: normalizedEmail,
          role: 'Admin',
          job_title: 'Relationship Manager',
          updated_at: new Date().toISOString(),
        });
      } catch (upsertErr) {
        console.warn('Upsert profile notice:', upsertErr);
      }

      saveLocalUser(userObj);
      return toPublicUser(userObj);
    }
  } catch (supabaseError) {
    console.error('Supabase register error:', supabaseError);

    // Jika terjadi error koneksi Supabase (misal URL salah atau belum aktif)
    const isConnError =
      supabaseError.message?.includes('fetch failed') ||
      supabaseError.message?.includes('Failed to fetch') ||
      supabaseError.message?.includes('NetworkError');

    if (isConnError) {
      // Fallback ke penyimpanan lokal sementara agar aplikasi tetap bisa dicoba
      console.warn('Menggunakan fallback pendaftaran lokal karena koneksi Supabase bermasalah.');
      const users = readUsers();
      if (users.some((user) => user.email === normalizedEmail)) {
        throw new Error('Email ini sudah terdaftar. Silakan masuk.');
      }

      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const salt = bytesToBase64(saltBytes);
      const passwordHash = await hashPassword(password, salt);
      const localUser = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: normalizedEmail,
        jobTitle: 'Relationship Manager',
        role: 'Admin',
        photo: '',
        salt,
        passwordHash,
      };

      saveLocalUser(localUser);
      return toPublicUser(localUser);
    }

    throw new Error(supabaseError.message || 'Registrasi gagal. Silakan coba lagi.');
  }
}

export async function authenticateUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Coba autentikasi via Supabase
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (!error && data?.user) {
      // Ambil data profil terbaru dari tabel public.profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const user = {
        id: data.user.id,
        name: profile?.name || data.user.user_metadata?.name || 'Insan BRILiaN',
        email: data.user.email,
        jobTitle: profile?.job_title || 'Relationship Manager',
        role: profile?.role || 'Admin',
        photo: profile?.photo_url || '',
      };

      saveAuthSession(user);
      saveLocalUser(user);
      return user;
    }

    if (error) {
      if (error.status === 400 || error.message?.toLowerCase().includes('invalid login credentials')) {
        return null;
      }
      throw error;
    }
  } catch (supabaseError) {
    console.error('Supabase login notice:', supabaseError);

    const isConnError =
      supabaseError.message?.includes('fetch failed') ||
      supabaseError.message?.includes('Failed to fetch') ||
      supabaseError.message?.includes('NetworkError');

    // Jika koneksi Supabase gagal, fallback cek ke user lokal
    if (isConnError) {
      console.warn('Mencoba autentikasi lokal karena server Supabase tidak terjangkau.');
      const localUser = readUsers().find((entry) => entry.email === normalizedEmail);
      if (localUser && localUser.passwordHash) {
        const passwordHash = await hashPassword(password, localUser.salt);
        if (passwordHash === localUser.passwordHash) {
          const publicUser = toPublicUser(localUser);
          saveAuthSession(publicUser);
          return publicUser;
        }
      }
      return null;
    }

    throw supabaseError;
  }

  return null;
}

export async function updateUserProfile(currentUser, changes) {
  const normalizedEmail = changes.email.trim().toLowerCase();

  try {
    // 1. Update ke tabel public.profiles di Supabase
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        name: changes.name.trim(),
        job_title: changes.jobTitle.trim(),
        photo_url: changes.photo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentUser.id);

    if (profileError) {
      console.warn('Supabase update profile notice:', profileError.message);
    }

    // 2. Jika ada password baru, update ke Supabase Auth
    if (changes.newPassword) {
      const { error: authError } = await supabase.auth.updateUser({
        password: changes.newPassword,
      });
      if (authError) {
        console.warn('Supabase update password notice:', authError.message);
      }
    }
  } catch (err) {
    console.warn('Gagal sinkronisasi profil ke Supabase:', err);
  }

  // Simpan pembaruan lokal & session
  const updatedUser = {
    ...currentUser,
    name: changes.name.trim(),
    email: normalizedEmail,
    jobTitle: changes.jobTitle.trim(),
    photo: changes.photo,
  };

  saveLocalUser(updatedUser);
  saveAuthSession(updatedUser);
  return updatedUser;
}

export function saveAuthSession(user) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
}

export function loadAuthSession() {
  try {
    const user = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    return user?.name && user?.email ? user : null;
  } catch {
    return null;
  }
}

export async function clearAuthSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Supabase signOut error:', err);
  }
}