import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const ADMIN_HOSTNAME = "pulze.fundingpulze.com";
const HELP_HOSTNAME = "help.fundingpulze.com";

const normalizeHost = (host: string) => host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");

export const useAdminSubdomain = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const hostname = normalizeHost(window.location.hostname);
  const isAdminDomain = hostname === normalizeHost(ADMIN_HOSTNAME);
  const isHelpDomain = hostname === normalizeHost(HELP_HOSTNAME);

  useEffect(() => {
    if (isAdminDomain && location.pathname !== "/admin" && location.pathname !== "/auth") {
      navigate("/admin", { replace: true });
    }
  }, [isAdminDomain, location.pathname, navigate]);

  return { isAdminDomain, isHelpDomain };
};
