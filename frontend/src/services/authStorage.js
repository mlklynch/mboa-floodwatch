const REGISTERED_KEY = "mboaFloodSubscribers";
const SESSION_KEY = "mboaFloodUser";

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function getStoredSubscribers() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(REGISTERED_KEY);
  return safeParse(raw) || [];
}

export function saveSubscriberToStorage(subscriber) {
  if (typeof window === "undefined") return null;
  const normalized = {
    name: subscriber.name || "",
    city: subscriber.city || "",
    phone: subscriber.phone || "",
    email: subscriber.email || "",
  };

  const list = getStoredSubscribers();
  const existingIndex = list.findIndex((item) => {
    if (normalized.email && item.email && item.email.toLowerCase() === normalized.email.toLowerCase()) {
      return true;
    }
    if (normalized.phone && item.phone && item.phone === normalized.phone) {
      return true;
    }
    return false;
  });

  if (existingIndex >= 0) {
    list[existingIndex] = normalized;
  } else {
    list.push(normalized);
  }

  window.localStorage.setItem(REGISTERED_KEY, JSON.stringify(list));
  return normalized;
}

export function findSubscriberByCredentials({ email, phone }) {
  const list = getStoredSubscribers();
  const trimmedEmail = email?.trim().toLowerCase() || "";
  const trimmedPhone = phone?.trim() || "";

  if (trimmedEmail) {
    const found = list.find((item) => item.email?.trim().toLowerCase() === trimmedEmail);
    if (found) return found;
  }

  if (trimmedPhone) {
    return list.find((item) => item.phone?.trim() === trimmedPhone) || null;
  }

  return null;
}

export function getSessionUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  return safeParse(raw);
}

export function setSessionUser(subscriber) {
  if (typeof window === "undefined") return null;
  const sessionData = {
    name: subscriber.name || "",
    city: subscriber.city || "",
    phone: subscriber.phone || "",
    email: subscriber.email || "",
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  return sessionData;
}

export function clearSessionUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}
