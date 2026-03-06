import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const ADMIN_HOSTNAME = "pulze.fundingpulze.com";

/**
 * When the app is accessed via the admin subdomain (pulze.fundingpulze.com),
 * automatically redirect all routes to /admin.
 */
export const useAdminSubdomain = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminDomain = window.location.hostname === ADMIN_HOSTNAME;

  useEffect(() => {
    if (isAdminDomain && location.pathname !== "/admin" && location.pathname !== "/auth") {
      navigate("/admin", { replace: true });
    }
  }, [isAdminDomain, location.pathname, navigate]);

  return { isAdminDomain };
};
