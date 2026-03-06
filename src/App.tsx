import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAdminSubdomain } from "@/hooks/useAdminSubdomain";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import Admin from "./pages/Admin";
import Checkout from "./pages/Checkout";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ADMIN_HOSTNAME = "pulze.fundingpulze.com";

const AppRoutes = () => {
  const { isAdminDomain } = useAdminSubdomain();

  // On the admin subdomain, only show admin + auth routes
  if (isAdminDomain) {
    return (
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/auth" element={<Auth />} />
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
