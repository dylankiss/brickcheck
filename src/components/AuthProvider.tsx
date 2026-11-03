import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "../hooks/useAuth";
import {
  getMyProfile,
  getSession,
  onAuthChange,
  signOut,
  updateMyName,
} from "../lib/api";
import type { Profile } from "../lib/types";

/** App-level auth state (the one component that uses lib/api, see ARCHITECTURE.md). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id;

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
    return onAuthChange((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfile(userId ? await getMyProfile(userId) : null);
  }, [userId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refreshProfile only sets state after awaiting the fetch
    refreshProfile().catch(() => setProfile(null));
  }, [refreshProfile]);

  const updateName = useCallback(
    async (name: string) => {
      if (!userId) return;
      await updateMyName(userId, name);
      await refreshProfile();
    },
    [userId, refreshProfile],
  );

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, refreshProfile, updateName, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
