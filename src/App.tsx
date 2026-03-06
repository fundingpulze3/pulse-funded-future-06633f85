import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAdminSubdomain } from "@/hooks/useAdminSubdomain";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import Admin from "./pages/Admin";
import Checkout from "./pages/Checkout";
import FAQ from "./pages/FAQ";
import HelpCenter from "./pages/HelpCenter";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAdminDomain, isHelpDomain } = useAdminSubdomain();

  // Help subdomain: only show help center
  if (isHelpDomain) {
    return (
      <Routes>
        <Route path="/help" element={<HelpCenter />} />
        <Route path="*" element={<HelpCenter />} />
      </Routes>
    );
  }

  // Admin subdomain: only show admin + admin auth routes
  if (isAdminDomain) {
    return (
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/auth" element={<AdminAuth />} />
        <Route path="*" element={<Admin />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/affiliate" element={<AffiliateDashboard />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/help" element={<HelpCenter />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
