import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import LiveChat from "@/components/LiveChat";
import { useAdminSubdomain } from "@/hooks/useAdminSubdomain";
import Index from "./pages/Index";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Checkout from "./pages/Checkout";
import FAQ from "./pages/FAQ";
import HelpCenter from "./pages/HelpCenter";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import DashboardCertificates from "./pages/DashboardCertificates";
import DashboardPayouts from "./pages/DashboardPayouts";
import DashboardSettings from "./pages/DashboardSettings";
import DashboardBilling from "./pages/DashboardBilling";
import DashboardAI from "./pages/DashboardAI";
import DashboardKYC from "./pages/DashboardKYC";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAdminDomain, isHelpDomain } = useAdminSubdomain();

  // Help subdomain: only show help center
  if (isHelpDomain) {
    return (
      <Routes>
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
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/affiliate" element={<AffiliateDashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/certificates" element={<DashboardCertificates />} />
      <Route path="/dashboard/payouts" element={<DashboardPayouts />} />
      <Route path="/dashboard/settings" element={<DashboardSettings />} />
      <Route path="/dashboard/billing" element={<DashboardBilling />} />
      <Route path="/dashboard/ai" element={<DashboardAI />} />
      <Route path="/dashboard/kyc" element={<DashboardKYC />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/about" element={<About />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/help/*" element={<HelpCenter />} />
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
          <LiveChat />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
