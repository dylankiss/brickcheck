import type { Session } from "@supabase/supabase-js";
import { createContext, useContext } from "react";
import type { Profile } from "../lib/types";

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  /** Why the profile could not be loaded, if it could not. */
  profileError: string | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  updateAvatar: (avatar: string | null) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  profileError: null,
  loading: true,
  refreshProfile: async () => {},
  updateName: async () => {},
  updateAvatar: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
