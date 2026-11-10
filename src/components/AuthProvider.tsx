import type { Session } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthContext } from "../hooks/useAuth";
import {
  getMyProfile,
  getSession,
  onAuthChange,
  signOut,
  updateMyAvatar,
  updateMyName,
} from "../lib/api";
import type { Profile } from "../lib/types";

/** App-level auth state (the one component that uses lib/api, see ARCHITECTURE.md). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Only the newest profile request may set state: an older one can finish
  // after a sign-out or an account switch.
  const latestProfileRequest = useRef(0);
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

  /** Never rejects: a failed load shows up as `profileError`. */
  const refreshProfile = useCallback(async () => {
    const request = ++latestProfileRequest.current;
    try {
      const next = userId ? await getMyProfile(userId) : null;
      if (request === latestProfileRequest.current) {
        setProfile(next);
        setProfileError(null);
      }
    } catch (e) {
      if (request === latestProfileRequest.current) {
        setProfile(null);
        setProfileError((e as Error).message);
      }
    }
  }, [userId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refreshProfile only sets state after awaiting the fetch
    refreshProfile();
  }, [refreshProfile]);

  const updateName = useCallback(
    async (name: string) => {
      if (!userId) {
        return;
      }
      await updateMyName(userId, name);
      await refreshProfile();
    },
    [userId, refreshProfile],
  );

  const updateAvatar = useCallback(
    async (avatar: string | null) => {
      if (!userId) {
        return;
      }
      await updateMyAvatar(userId, avatar);
      await refreshProfile();
    },
    [userId, refreshProfile],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        profileError,
        loading,
        refreshProfile,
        updateName,
        updateAvatar,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
