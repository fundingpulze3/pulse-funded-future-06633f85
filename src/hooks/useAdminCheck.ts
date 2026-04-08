import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "administrator" | "admin" | "moderator" | "employee" | "user" | null;

const ROLE_PRIORITY: Exclude<UserRole, null>[] = ["administrator", "admin", "employee", "moderator", "user"];

export const useAdminCheck = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!user) {
      setIsAdmin(false);
      setUserRole(null);
      setLoading(false);
      return;
    }

    const checkRole = async () => {
      try {
        let resolvedRole: UserRole = null;

        const { data: roleData, error: rpcError } = await supabase.rpc("get_user_role", {
          _user_id: user.id,
        });

        if (!rpcError && roleData) {
          resolvedRole = roleData as UserRole;
        } else {
          const { data: roles, error: rolesError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

          if (rolesError) throw rolesError;

          resolvedRole = ROLE_PRIORITY.find((role) => roles?.some((row) => row.role === role)) ?? null;
        }

        if (!mounted) return;

        setUserRole(resolvedRole);
        setIsAdmin(resolvedRole === "administrator" || resolvedRole === "admin" || resolvedRole === "employee");
      } catch {
        if (!mounted) return;
        setUserRole(null);
        setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkRole();

    return () => {
      mounted = false;
    };
  }, [user]);

  return { isAdmin, userRole, loading };
};
