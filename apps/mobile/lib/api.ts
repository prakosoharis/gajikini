import AsyncStorage from '@react-native-async-storage/async-storage';

// Dev di WiFi yang sama: jalankan expo dengan EXPO_PUBLIC_API_URL=http://<IP-laptop>:4000
// Tanpa env (mis. build APK demo investor): memakai API produksi di server sendiri.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api-gajikini.deluwang.online';

export interface Session {
  userId: string;
  name: string;
  employerName: string;
}

const KEY = 'gk_session';

export async function getSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: Session) {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

export async function clearSession() {
  await AsyncStorage.removeItem(KEY);
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'x-user-id': session.userId } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { message?: string | string[] }).message;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg || `HTTP ${res.status}`);
  }
  return body as T;
}
