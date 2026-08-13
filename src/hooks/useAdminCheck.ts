import { useState, useEffect, useRef } from "react";
import { db as supabase } from "@/integrations/db/client";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "administrator" | "admin" | "moderator" | "employee" | "user" | null;

const ROLE_PRIORITY: Exclude<UserRole, null>[] = ["administrator", "admin", "employee", "moderator", "user"];

export const useAdminCheck = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Cache: avoid re-fetching for the same user on token refreshes
  const cachedUserId = useRef<string | null>(null);
  const cachedRole = useRef<UserRole>(null);
  const fetchingRef = useRef(false);

  const userId = user?.id ?? null;

  useEffect(() => {
    let mounted = true;

    // Still waiting for auth to initialise
    if (authLoading) {
      return () => { mounted = false; };
    }

    // No user → reset
    if (!userId) {
      cachedUserId.current = null;
      cachedRole.current = null;
      setIsAdmin(false);
      setUserRole(null);
      setLoading(false);
      return () => { mounted = false; };
    }

    // If we already resolved this user's role, reuse the cache instantly
    // This prevents the flicker on token refreshes
    if (cachedUserId.current === userId && cachedRole.current !== null) {
      setUserRole(cachedRole.current);
      setIsAdmin(
        cachedRole.current === "administrator" ||
        cachedRole.current === "admin" ||
        cachedRole.current === "employee"
      );
      setLoading(false);
      return () => { mounted = false; };
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) {
      return () => { mounted = false; };
    }

    setLoading(true);
    fetchingRef.current = true;

    const checkRole = async () => {
      try {
        let resolvedRole: UserRole = null;

        const { data: roleData, error: rpcError } = await supabase.rpc("get_user_role", {
          _user_id: userId,
        });

        if (!rpcError && roleData) {
          resolvedRole = roleData as UserRole;
        } else {
          const { data: roles, error: rolesError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);

          if (rolesError) throw rolesError;

          resolvedRole = ROLE_PRIORITY.find((role) => roles?.some((row) => row.role === role)) ?? null;
        }

        if (!mounted) return;

        // Cache the result
        cachedUserId.current = userId;
        cachedRole.current = resolvedRole;

        setUserRole(resolvedRole);
        setIsAdmin(resolvedRole === "administrator" || resolvedRole === "admin" || resolvedRole === "employee");
      } catch {
        if (!mounted) return;
        setUserRole(null);
        setIsAdmin(false);
      } finally {
        fetchingRef.current = false;
        if (mounted) setLoading(false);
      }
    };

    checkRole();

    return () => {
      mounted = false;
    };
  }, [authLoading, userId]);

  return { isAdmin, userRole, loading };
};
