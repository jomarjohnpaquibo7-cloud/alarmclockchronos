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
export const isFirebaseConfigured = configured;
async function getUser() {
  if (!auth) throw new Error('Firebase is not configured. Add Firebase web app settings in GitHub Actions variables.');
  if (!authPromise) authPromise = signInAnonymously(auth).then(c => c.user).catch(e => { authPromise = null; throw e; });
  return authPromise;
}
function localKey(key: string) { return 'chronos_state_' + key; }
export async function loadState(key: string): Promise<AppState> {
  if (!db) { try { return JSON.parse(localStorage.getItem(localKey(key)) || '{"schedules":[],"notes":[]}'); } catch { return { schedules: [], notes: [] }; } }
  const user = await getUser(); const snap = await getDoc(doc(db, 'userStates', user.uid));
  return snap.exists() ? snap.data().state as AppState : { schedules: [], notes: [] };
}
export async function saveState(key: string, state: AppState): Promise<void> {
  if (!db) { localStorage.setItem(localKey(key), JSON.stringify(state)); return; }
  const user = await getUser(); await setDoc(doc(db, 'userStates', user.uid), { state, updatedAt: new Date().toISOString() });
}
