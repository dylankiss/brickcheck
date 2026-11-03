import type { Session } from "@supabase/supabase-js";
import { createContext, useContext } from "react";
import type { Profile } from "../lib/types";

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  updateName: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
