import { auth, getFirebaseIdToken } from "@/services/firebase";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: "firebase" | null;
  lastSignedIn: Date;
};

/** Returns the current Firebase ID token for authenticated API calls. */
export async function getSessionToken(): Promise<string | null> {
  return getFirebaseIdToken();
}

/** Kept for compatibility; Firebase owns token storage and rotation. */
export async function setSessionToken(_token: string): Promise<void> {
  return undefined;
}

/** Firebase persists and removes the authentication session itself. */
export async function removeSessionToken(): Promise<void> {
  return undefined;
}

export async function getUserInfo(): Promise<User | null> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;
  return {
    id: -1,
    openId: firebaseUser.uid,
    name: firebaseUser.displayName,
    email: firebaseUser.email,
    loginMethod: "firebase",
    lastSignedIn: new Date(),
  };
}

export async function setUserInfo(_user: User): Promise<void> {
  return undefined;
}

export async function clearUserInfo(): Promise<void> {
  return undefined;
}
