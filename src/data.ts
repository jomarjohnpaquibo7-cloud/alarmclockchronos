import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, type User } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

export type AppState = { schedules: any[]; notes: any[] };

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
const configured = Object.values(firebaseConfig).every(v => typeof v === 'string' && v.length > 0);
const app = configured ? (getApps()[0] ?? initializeApp(firebaseConfig)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
let authPromise: Promise<User> | null = null;
let onlineSyncRegistered = false;
let activeClientKey: string | null = null;

export const isFirebaseConfigured = configured;

async function getUser() {
  if (!auth) throw new Error('Firebase is not configured.');
  if (!authPromise) {
    authPromise = signInAnonymously(auth).then(c => c.user).catch(e => {
      authPromise = null;
      throw e;
    });
  }
  return authPromise;
}

function localKey(key: string) { return 'chronos_state_' + key; }
function pendingKey(key: string) { return 'chronos_pending_sync_' + key; }
function readLocal(key: string): AppState | null {
  try {
    const raw = localStorage.getItem(localKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { schedules: parsed.schedules || [], notes: parsed.notes || [] };
  } catch {
    return null;
  }
}
function writeLocal(key: string, state: AppState) {
  localStorage.setItem(localKey(key), JSON.stringify(state));
}

async function flushPending(key: string) {
  if (!db || !auth || !navigator.onLine) return;
  const state = readLocal(key);
  if (!state || localStorage.getItem(pendingKey(key)) !== '1') return;
  try {
    const user = await getUser();
    await setDoc(doc(db, 'userStates', user.uid), {
      state,
      updatedAt: new Date().toISOString(),
    });
    localStorage.removeItem(pendingKey(key));
  } catch {
    // Keep the local copy and pending marker; the next online event retries.
  }
}

function registerOnlineSync(key: string) {
  activeClientKey = key;
  if (onlineSyncRegistered || typeof window === 'undefined') return;
  onlineSyncRegistered = true;
  window.addEventListener('online', () => {
    if (activeClientKey) void flushPending(activeClientKey);
  });
}

export async function loadState(key: string): Promise<AppState> {
  registerOnlineSync(key);
  const cached = readLocal(key);
  if (!db) return cached || { schedules: [], notes: [] };
  if (!navigator.onLine) return cached || { schedules: [], notes: [] };

  // Never replace locally edited data with stale cloud data while a sync is pending.
  if (localStorage.getItem(pendingKey(key)) === '1') {
    await flushPending(key);
    return readLocal(key) || cached || { schedules: [], notes: [] };
  }

  try {
    const user = await getUser();
    const snap = await getDoc(doc(db, 'userStates', user.uid));
    const remote = snap.exists()
      ? snap.data().state as AppState
      : { schedules: [], notes: [] };
    writeLocal(key, remote);
    return remote;
  } catch {
    // Offline or cloud unavailable: keep the app usable with the local copy.
    return cached || { schedules: [], notes: [] };
  }
}

export async function saveState(key: string, state: AppState): Promise<void> {
  // Persist first, so a network failure cannot discard the user's changes.
  writeLocal(key, state);
  if (!db) return;
  localStorage.setItem(pendingKey(key), '1');
  registerOnlineSync(key);
  if (!navigator.onLine) return;
  await flushPending(key);
}
