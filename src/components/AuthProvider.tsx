import { useEffect, useState, type ReactNode } from "react";
import { AuthContext, type AuthState } from "../hooks/useAuth";
import { getSession, onAuthChange } from "../lib/api";

/** App-level auth state (the one component that uses lib/api, see ARCHITECTURE.md). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: true,
  });

  useEffect(() => {
    getSession().then((session) => setState({ session, loading: false }));
    return onAuthChange((session) => setState({ session, loading: false }));
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
