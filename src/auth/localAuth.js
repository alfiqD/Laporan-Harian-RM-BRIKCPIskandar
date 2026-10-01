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

export async function registerUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = readUsers();

  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error('Email ini sudah terdaftar. Silakan masuk.');
  }

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToBase64(saltBytes);
  const passwordHash = await hashPassword(password, salt);
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    jobTitle: 'Relationship Manager',
    role: 'Admin',
    photo: '',
    salt,
    passwordHash,
  };

  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([...users, user]));
  return toPublicUser(user);
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobTitle: user.jobTitle || 'Relationship Manager',
    role: user.role || 'Admin',
    photo: user.photo || '',
  };
}

export async function authenticateUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = readUsers().find((entry) => entry.email === normalizedEmail);

  if (!user) {
    return null;
  }

  const passwordHash = await hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    return null;
  }

  return toPublicUser(user);
}

export async function updateUserProfile(currentUser, changes) {
  const users = readUsers();
  const userIndex = users.findIndex((user) => user.id === currentUser.id);

  if (userIndex === -1) {
    throw new Error('Akun tidak ditemukan. Silakan daftar kembali.');
  }

  const normalizedEmail = changes.email.trim().toLowerCase();
  const emailInUse = users.some(
    (user, index) => index !== userIndex && user.email === normalizedEmail,
  );
  if (emailInUse) {
    throw new Error('Email tersebut sudah digunakan akun lain.');
  }

  const updatedUser = {
    ...users[userIndex],
    name: changes.name.trim(),
    email: normalizedEmail,
    jobTitle: changes.jobTitle.trim(),
    photo: changes.photo,
  };

  if (changes.newPassword) {
    const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
    updatedUser.salt = salt;
    updatedUser.passwordHash = await hashPassword(changes.newPassword, salt);
  }

  users[userIndex] = updatedUser;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  return toPublicUser(updatedUser);
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

export function clearAuthSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}