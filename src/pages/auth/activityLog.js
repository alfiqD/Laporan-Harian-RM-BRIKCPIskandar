const ACTIVITY_STORAGE_KEY = 'bri-app-activity-v1';
const ACTIVITY_EVENT_NAME = 'bri-app-activity-update';
const MAX_ACTIVITY_RECORDS = 300;

function getUserKey(user) {
  return user.id || user.email.trim().toLowerCase();
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

export function recordActivity(user, action, detail) {
  const activities = readAllActivities();
  const activity = {
    id: crypto.randomUUID(),
    userKey: getUserKey(user),
    action,
    detail,
    timestamp: new Date().toISOString(),
  };

  activities.push(activity);
  localStorage.setItem(
    ACTIVITY_STORAGE_KEY,
    JSON.stringify(activities.slice(-MAX_ACTIVITY_RECORDS)),
  );
  window.dispatchEvent(new Event(ACTIVITY_EVENT_NAME));
}

export function subscribeToActivities(onUpdate) {
  const handleActivityUpdate = () => onUpdate();
  const handleStorageUpdate = (event) => {
    if (event.key === ACTIVITY_STORAGE_KEY) onUpdate();
  };

  window.addEventListener(ACTIVITY_EVENT_NAME, handleActivityUpdate);
  window.addEventListener('storage', handleStorageUpdate);

  return () => {
    window.removeEventListener(ACTIVITY_EVENT_NAME, handleActivityUpdate);
    window.removeEventListener('storage', handleStorageUpdate);
  };
}

export function formatActivityTime(timestamp) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}