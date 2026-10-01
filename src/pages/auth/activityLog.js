import { supabase } from '../../config/supabaseClient.js';

const ACTIVITY_STORAGE_KEY = 'bri-app-activity-v1';
const ACTIVITY_EVENT_NAME = 'bri-app-activity-update';
const MAX_ACTIVITY_RECORDS = 300;

function getUserKey(user) {
  return user?.id || user?.email?.trim().toLowerCase();
}

function readAllActivities() {
  try {
    const activities = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || '[]');
    return Array.isArray(activities) ? activities : [];
  } catch {
    return [];
  }
}

export function getUserActivities(user) {
  const userKey = getUserKey(user);
  return readAllActivities()
    .filter((activity) => activity.userKey === userKey)
    .sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp));
}

export async function fetchActivitiesFromSupabase(user) {
  if (!user?.id) return getUserActivities(user);

  try {
    const { data, error } = await supabase
      .from('aktivitas_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map((item) => ({
        id: item.id,
        userKey: item.user_id,
        action: item.action,
        detail: item.detail,
        timestamp: item.created_at,
      }));

      // Gabungkan dengan aktivitas lokal jika ada
      const local = readAllActivities().filter((act) => act.userKey !== user.id);
      localStorage.setItem(
        ACTIVITY_STORAGE_KEY,
        JSON.stringify([...mapped, ...local].slice(-MAX_ACTIVITY_RECORDS)),
      );
      return mapped;
    }
  } catch (err) {
    console.warn('Gagal memuat aktivitas dari Supabase:', err);
  }

  return getUserActivities(user);
}

export function recordActivity(user, action, detail) {
  const userKey = getUserKey(user);
  const activities = readAllActivities();
  const timestamp = new Date().toISOString();
  const activity = {
    id: crypto.randomUUID(),
    userKey,
    action,
    detail,
    timestamp,
  };

  activities.push(activity);
  localStorage.setItem(
    ACTIVITY_STORAGE_KEY,
    JSON.stringify(activities.slice(-MAX_ACTIVITY_RECORDS)),
  );
  window.dispatchEvent(new Event(ACTIVITY_EVENT_NAME));

  // Asinkron simpan ke tabel public.aktivitas_log di Supabase
  if (user?.id) {
    supabase
      .from('aktivitas_log')
      .insert({
        user_id: user.id,
        user_name: user.name || 'RM',
        action,
        detail,
        created_at: timestamp,
      })
      .then(({ error }) => {
        if (error) console.warn('Supabase log notice:', error.message);
      })
      .catch((err) => console.warn('Supabase log error:', err));
  }
}

export function subscribeToActivities(userOrCb, maybeCb) {
  const onUpdate = typeof userOrCb === 'function' ? userOrCb : maybeCb;
  const user = typeof userOrCb === 'object' ? userOrCb : null;

  const handleActivityUpdate = () => onUpdate?.();
  const handleStorageUpdate = (event) => {
    if (event.key === ACTIVITY_STORAGE_KEY) onUpdate?.();
  };

  window.addEventListener(ACTIVITY_EVENT_NAME, handleActivityUpdate);
  window.addEventListener('storage', handleStorageUpdate);

  // Subscribe ke real-time Supabase jika didukung
  let channel = null;
  if (user?.id) {
    try {
      channel = supabase
        .channel(`public:aktivitas_log:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'aktivitas_log',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            onUpdate();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription notice:', err);
    }
  }

  return () => {
    window.removeEventListener(ACTIVITY_EVENT_NAME, handleActivityUpdate);
    window.removeEventListener('storage', handleStorageUpdate);
    if (channel) {
      supabase.removeChannel(channel);
    }
  };
}

export function formatActivityTime(timestamp) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return String(timestamp);
  }
}