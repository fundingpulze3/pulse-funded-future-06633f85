import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Shield,
  Check,
  Tag,
  X,
  Loader2,
  CreditCard,
  Bitcoin,
  ExternalLink,
} from "lucide-react";
import { useUtmTracking, getStoredUtm } from "@/hooks/useUtmTracking";
import Navbar from "@/components/Navbar";

declare global {
  interface Window {
    paypal?: any;
  }
}

const Checkout = () => {
  useUtmTracking();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const paypalRef = useRef<HTMLDivElement>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const stepType = searchParams.get("step") || "2-step";
  const accountSize = searchParams.get("size") || "$50K";
  const basePrice = Number(searchParams.get("price") || "289");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{
    code: string;
    type: string;
    value: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const subtotal = basePrice;

  let discount = 0;
  if (couponApplied) {
    if (couponApplied.type === "percentage") {
      discount = Math.round(subtotal * (couponApplied.value / 100));
    } else {
      discount = Math.min(couponApplied.value, subtotal);
    }
  }
  const total = subtotal - discount;

  // PayPal SDK init
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.paypal) {
        setPaypalReady(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Render PayPal buttons
  useEffect(() => {
    if (!paypalReady || !paypalRef.current || !user) return;

    // Clear previous buttons
    paypalRef.current.innerHTML = "";

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    window.paypal.Buttons({
      style: {
        layout: "vertical",
        color: "black",
        shape: "rect",
        label: "pay",
        height: 48,
      },
      createOrder: async () => {
        // First create the DB purchase record
        const sizeNum = parseInt(accountSize.replace(/[$,K]/gi, "")) * 1000;
        const dbStepType = stepType === "1-step" ? "one_step" : "two_step";

        const { data: challenge } = await supabase
          .from("challenges")
          .select("id")
          .eq("step_type", dbStepType)
          .eq("account_size", sizeNum)
          .eq("is_active", true)
          .maybeSingle();

        if (!challenge) throw new Error("Challenge not found");

        const utm = getStoredUtm();
        const { data: purchase, error } = await supabase
          .from("challenge_purchases")
          .insert({
            user_id: user.id,
            challenge_id: challenge.id,
            amount_paid: total,
            payment_status: "pending",
            status: "pending",
            utm_source: utm.utm_source || null,
            utm_medium: utm.utm_medium || null,
            utm_campaign: utm.utm_campaign || null,
            utm_term: utm.utm_term || null,
            utm_content: utm.utm_content || null,
          })
          .select()
          .single();

        if (error || !purchase) throw new Error("Failed to create order");
        setPurchaseId(purchase.id);

        // Create PayPal order via edge function
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/verify-paypal-order`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session!.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "create",
              orderData: {
                amount: total.toFixed(2),
                currency: "USD",
                description: `${stepType === "1-step" ? "1 Step" : "2 Step"} Challenge — ${accountSize}`,
              },
            }),
          }
        );

        const data = await res.json();
        if (!data.orderID) throw new Error(data.error || "Failed to create PayPal order");
        return data.orderID;
      },
      onApprove: async (data: any) => {
        setProcessing(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/verify-paypal-order`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session!.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "capture",
                orderID: data.orderID,
                purchaseId,
              }),
            }
          );

          const result = await res.json();
          if (result.success) {
            toast.success("Payment successful! Your account is being activated.");
            navigate("/dashboard");
          } else {
            toast.error(result.error || "Payment verification failed.");
          }
        } catch (err) {
          toast.error("Payment failed: " + String(err));
        }
        setProcessing(false);
      },
      onError: (err: any) => {
        console.error("PayPal error:", err);
        toast.error("PayPal payment failed. Please try again.");
      },
      onCancel: () => {
        toast.info("Payment cancelled.");
      },
    }).render(paypalRef.current);
  }, [paypalReady, user, total, stepType, accountSize, purchaseId]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", couponCode.toUpperCase().trim())
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      toast.error("Invalid or expired coupon code.");
      setCouponLoading(false);
      return;
    }

    if (data.max_uses && data.current_uses >= data.max_uses) {
      toast.error("This coupon has reached its usage limit.");
      setCouponLoading(false);
      return;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error("This coupon has expired.");
      setCouponLoading(false);
      return;
    }

    setCouponApplied({
      code: data.code,
      type: data.discount_type,
      value: data.discount_value,
    });
    toast.success(`Coupon "${data.code}" applied!`);
    setCouponLoading(false);
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponCode("");
  };

  // Manual payment fallback
  const handleManualPayment = async () => {
    if (!user) {
      toast.error("Please sign in to continue.");
      navigate("/auth");
      return;
    }

    setProcessing(true);
    try {
      const sizeNum = parseInt(accountSize.replace(/[$,K]/gi, "")) * 1000;
      const dbStepType = stepType === "1-step" ? "one_step" : "two_step";

      const { data: challenge } = await supabase
        .from("challenges")
        .select("id")
        .eq("step_type", dbStepType)
        .eq("account_size", sizeNum)
        .eq("is_active", true)
        .maybeSingle();

      if (!challenge) {
        toast.error("Challenge not found.");
        setProcessing(false);
        return;
      }

      const utm = getStoredUtm();
      const { error } = await supabase
        .from("challenge_purchases")
        .insert({
          user_id: user.id,
          challenge_id: challenge.id,
          amount_paid: total,
          payment_status: "pending",
          status: "pending",
          utm_source: utm.utm_source || null,
          utm_medium: utm.utm_medium || null,
          utm_campaign: utm.utm_campaign || null,
          utm_term: utm.utm_term || null,
          utm_content: utm.utm_content || null,
        });

      if (error) {
        toast.error("Failed to create order.");
        setProcessing(false);
        return;
      }

      toast.success("Order placed! Payment is being reviewed.");
      navigate("/dashboard");
    } catch {
      toast.error("Something went wrong.");
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} />

      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">Checkout</h1>
        <p className="text-muted-foreground mb-10">Complete your purchase to start trading.</p>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* LEFT — Payment Methods */}
          <div className="lg:col-span-3 space-y-8">
            {/* Challenge Summary Card */}
            <div className="glass-card p-6">
              <h3 className="font-display text-lg font-semibold mb-4">Your Challenge</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {stepType === "1-step" ? "1 Step" : "2 Step"} Challenge
                  </p>
                  <p className="font-display text-2xl font-bold mt-1">{accountSize}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl font-bold">${basePrice}</p>
                </div>
              </div>
            </div>

            {/* Coupon Code */}
            <div className="glass-card p-6">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Tag size={18} /> Coupon Code
              </h3>
              {couponApplied ? (
                <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Check size={18} className="text-primary" />
                    <div>
                      <p className="text-sm font-bold font-mono tracking-wider">
                        {couponApplied.code}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {couponApplied.type === "percentage"
                          ? `${couponApplied.value}% off`
                          : `$${couponApplied.value} off`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon code"
                    className="rounded-xl bg-secondary border-border font-mono uppercase tracking-wider"
                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                  />
                  <Button
                    onClick={applyCoupon}
                    variant="outline"
                    className="rounded-xl px-6 border-border"
                    disabled={couponLoading || !couponCode.trim()}
                  >
                    {couponLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* PayPal Payment */}
            <div className="glass-card p-6">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard size={18} /> Pay with PayPal
              </h3>
              {!user ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-3">Please sign in to proceed with payment</p>
                  <Button onClick={() => navigate("/auth")} variant="outline" className="rounded-xl">
                    Sign In
                  </Button>
                </div>
              ) : !paypalReady ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Loading PayPal...</span>
                </div>
              ) : (
                <div ref={paypalRef} className="min-h-[60px]" />
              )}

              {processing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  Verifying payment...
                </div>
              )}
            </div>

            {/* Manual Payment Fallback */}
            <div className="glass-card p-6">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard size={18} /> Manual Payment (Crypto / Bank Transfer)
              </h3>
              <div className="bg-secondary/50 border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Pay via crypto or bank transfer, then click <strong>"I Have Paid"</strong>. Our team will verify and activate within 24 hours.
                </p>
                <Button
                  onClick={handleManualPayment}
                  disabled={processing}
                  variant="outline"
                  className="w-full rounded-xl py-5"
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Check size={16} /> I Have Paid — ${total}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT — Order Summary Sticky */}
          <div className="lg:col-span-2">
            <div className="glass-card p-6 lg:sticky lg:top-24">
              <h3 className="font-display text-lg font-semibold mb-6">Order Summary</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {stepType === "1-step" ? "1 Step" : "2 Step"} — {accountSize}
                  </span>
                  <span className="font-medium">${basePrice}</span>
                </div>

                {couponApplied && (
                  <div className="flex justify-between text-primary">
                    <span>Coupon ({couponApplied.code})</span>
                    <span className="font-medium">-${discount}</span>
                  </div>
                )}

                <div className="border-t border-border/50 pt-3 mt-3">
                  <div className="flex justify-between items-end">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-display text-3xl font-bold">${total}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Shield size={14} />
                <span>256-bit SSL encrypted payment</span>
              </div>

              {/* Trust badges */}
              <div className="mt-6 pt-4 border-t border-border/50 grid grid-cols-2 gap-3">
                {["Instant Access", "24/7 Support"].map((badge) => (
                  <div key={badge} className="text-center">
                    <Check size={14} className="text-primary mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground leading-tight">{badge}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
