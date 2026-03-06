import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const ADMIN_HOSTNAME = "pulze.fundingpulze.com";
const HELP_HOSTNAME = "help.fundingpulze.com";

export const useAdminSubdomain = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminDomain = window.location.hostname === ADMIN_HOSTNAME;
  const isHelpDomain = window.location.hostname === HELP_HOSTNAME;

  useEffect(() => {
    if (isAdminDomain && location.pathname !== "/admin" && location.pathname !== "/auth") {
      navigate("/admin", { replace: true });
    }
    if (isHelpDomain && location.pathname !== "/help") {
      navigate("/help", { replace: true });
    }
  }, [isAdminDomain, isHelpDomain, location.pathname, navigate]);

  return { isAdminDomain, isHelpDomain };
};
