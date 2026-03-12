import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "administrator" | "admin" | "moderator" | "employee" | "user" | null;

export const useAdminCheck = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setUserRole(null);
      setLoading(false);
      return;
    }

    const checkRole = async () => {
      // Get the user's highest role
      const { data: roleData } = await supabase.rpc("get_user_role", {
        _user_id: user.id,
      });

      const role = (roleData as string | null) as UserRole;
      setUserRole(role);
      // administrator, admin, and employee all have panel access
      setIsAdmin(role === "administrator" || role === "admin" || role === "employee");
      setLoading(false);
    };

    checkRole();
  }, [user]);

  return { isAdmin, userRole, loading };
};
