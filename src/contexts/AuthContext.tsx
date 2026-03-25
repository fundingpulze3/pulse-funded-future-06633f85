import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = "sb-rpshiyvndmnogbhbgmfm-auth-token";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;

        // Failed token refresh — nuke the stale token immediately
        if (event === "TOKEN_REFRESHED" && !currentSession) {
          console.warn("Token refresh failed — clearing stale session");
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // On sign out, clean up
        if (event === "SIGNED_OUT") {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Send password-changed alert
        if (event === "USER_UPDATED" && currentSession?.user) {
          supabase.functions
            .invoke("send-transactional-email", {
              body: { type: "password_changed", data: {} },
            })
            .catch(() => {});
        }
      }
    );

    // Then get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: s }, error }) => {
        if (!mounted) return;
        if (error) {
          console.warn("getSession failed:", error.message);
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          setSession(null);
          setUser(null);
        } else {
          setSession(s);
          setUser(s?.user ?? null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
