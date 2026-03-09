import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Shield,
  Check,
  Tag,
  X,
  Loader2,
  CreditCard,
  Bitcoin,
  Wallet,
} from "lucide-react";
import { useUtmTracking, getStoredUtm } from "@/hooks/useUtmTracking";
import Navbar from "@/components/Navbar";

const Checkout = () => {
  useUtmTracking();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

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
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
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

  const handlePayment = async () => {
    if (!user) {
      toast.error("Please sign in to continue.");
      navigate("/auth");
      return;
    }
    if (!selectedGateway) {
      toast.error("Please select a payment method.");
      return;
    }

    setProcessing(true);
    await new Promise((r) => setTimeout(r, 2000));

    // Send purchase confirmation email
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            type: "purchase_confirmation",
            data: {
              challengeName: `${stepType === "1-step" ? "1 Step" : "2 Step"} Challenge`,
              accountSize,
              amountPaid: `$${total}`,
            },
          },
        });
      }
    } catch (emailErr) {
      console.error("Failed to send confirmation email:", emailErr);
    }

    toast.success("Order placed! You'll receive confirmation shortly.");
    setProcessing(false);
    navigate("/");
  };

  const gateways = [
    {
      id: "nowpayments",
      name: "NOWPayments",
      desc: "Pay with Crypto",
      icon: <Bitcoin size={22} />,
      tag: "BTC, ETH, USDT & 200+",
    },
    {
      id: "paypal",
      name: "PayPal",
      desc: "Pay with PayPal",
      icon: <Wallet size={22} />,
      tag: "Cards, Balance & More",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border/50 backdrop-blur-md bg-background/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield size={16} />
            <span className="text-xs font-medium">Secure Checkout</span>
          </div>
        </div>
      </div>

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

            {/* Payment Methods */}
            <div className="glass-card p-6">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard size={18} /> Payment Method
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {gateways.map((gw) => (
                  <button
                    key={gw.id}
                    onClick={() => setSelectedGateway(gw.id)}
                    className={`relative flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-300 text-left group ${
                      selectedGateway === gw.id
                        ? "border-primary bg-primary/5 shadow-[0_0_30px_-10px_hsl(var(--glow-primary)/0.3)]"
                        : "border-border hover:border-muted-foreground/30 hover:bg-secondary/50"
                    }`}
                  >
                    {selectedGateway === gw.id && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check size={12} className="text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        selectedGateway === gw.id
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      } transition-colors`}
                    >
                      {gw.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{gw.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{gw.tag}</p>
                    </div>
                  </button>
                ))}
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

              <Button
                onClick={handlePayment}
                disabled={processing || !selectedGateway}
                className="w-full mt-6 rounded-xl py-6 text-base font-semibold glow-box"
                size="lg"
              >
                {processing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Processing...
                  </span>
                ) : (
                  `Pay $${total}`
                )}
              </Button>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
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
