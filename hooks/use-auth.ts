import { listenToAuthSession, logoutFirebase } from "@/services/firebase";
import type { User } from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    // Firebase onAuthStateChanged is the single source of truth. The callback
    // below performs the Firestore profile and subscription verification.
    setLoading(true);
    setError(null);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutFirebase();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Déconnexion Firebase impossible."));
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return undefined;
    }
    const unsubscribe = listenToAuthSession((profile, errorMessage, sessionCheck) => {
      if (profile) {
        setUser({
          id: -1,
          openId: profile.uid,
          name: profile.username,
          email: null,
          loginMethod: "firebase",
          lastSignedIn: new Date(),
        });
        setError(null);
        setLoading(false);
        return;
      }
      setUser(null);
      if (errorMessage && !(sessionCheck?.authenticated && sessionCheck.retryable)) {
        setError(new Error(errorMessage));
      }
      setLoading(Boolean(sessionCheck?.authenticated && sessionCheck.retryable));
    });
    return unsubscribe;
  }, [autoFetch]);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);
  return { user, loading, error, isAuthenticated, refresh, logout };
}
