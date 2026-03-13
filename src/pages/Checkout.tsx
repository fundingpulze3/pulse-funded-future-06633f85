import { useState, useEffect, useRef, useCallback } from "react";
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
  ArrowLeft,
} from "lucide-react";
import { useUtmTracking, getStoredUtm } from "@/hooks/useUtmTracking";

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
  const paypalRef = useRef<HTMLDivElement>(null);
  const purchaseIdRef = useRef<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  const stepType = searchParams.get("step") || "2-step";
  const accountSize = searchParams.get("size") || "$50K";
  const basePrice = Number(searchParams.get("price") || "289");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; type: string; value: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [payMethod, setPayMethod] = useState<"paypal" | "crypto" | "manual">("paypal");

  let discount = 0;
  if (couponApplied) {
    discount = couponApplied.type === "percentage"
      ? Math.round(basePrice * (couponApplied.value / 100))
      : Math.min(couponApplied.value, basePrice);
  }
  const total = basePrice - discount;
  const totalRef = useRef(total);
  totalRef.current = total;

  // PayPal SDK init
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.paypal) { setPaypalReady(true); clearInterval(interval); }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const createPurchaseRecord = useCallback(async () => {
    if (!user) throw new Error("Not signed in");
    const sizeNum = parseInt(accountSize.replace(/[$,K]/gi, "")) * 1000;
    const dbStepType = stepType === "1-step" ? "one_step" : "two_step";
    const { data: challenge } = await supabase
      .from("challenges").select("id")
      .eq("step_type", dbStepType).eq("account_size", sizeNum).eq("is_active", true).maybeSingle();
    if (!challenge) throw new Error("Challenge not found");
    const utm = getStoredUtm();
    const { data: purchase, error } = await supabase
      .from("challenge_purchases")
      .insert({
        user_id: user.id, challenge_id: challenge.id, amount_paid: totalRef.current,
        payment_status: "pending", status: "pending",
        utm_source: utm.utm_source || null, utm_medium: utm.utm_medium || null,
        utm_campaign: utm.utm_campaign || null, utm_term: utm.utm_term || null,
        utm_content: utm.utm_content || null,
      }).select().single();
    if (error || !purchase) throw new Error("Failed to create order");
    return purchase;
  }, [user, accountSize, stepType]);

  // Render PayPal buttons — NO purchaseId in deps to avoid destroying buttons mid-flow
  useEffect(() => {
    if (!paypalReady || !paypalRef.current || !user) return;
    paypalRef.current.innerHTML = "";
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    window.paypal.Buttons({
      style: { layout: "vertical", color: "black", shape: "rect", label: "pay", height: 40 },
      createOrder: async () => {
        const purchase = await createPurchaseRecord();
        purchaseIdRef.current = purchase.id;
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/verify-paypal-order`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
              orderData: {
                amount: totalRef.current.toFixed(2), currency: "USD",
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
              headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ action: "capture", orderID: data.orderID, purchaseId: purchaseIdRef.current }),
            }
          );
          const result = await res.json();
          if (result.success) { toast.success("Payment successful!"); navigate("/dashboard"); }
          else toast.error(result.error || "Payment verification failed.");
        } catch (err) { toast.error("Payment failed: " + String(err)); }
        setProcessing(false);
      },
      onError: (err: any) => { console.error("PayPal error:", err); toast.error("PayPal payment failed."); },
      onCancel: () => toast.info("Payment cancelled."),
    }).render(paypalRef.current);
  }, [paypalReady, user, createPurchaseRecord, stepType, accountSize]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    const { data, error } = await supabase
      .from("coupons").select("*")
      .eq("code", couponCode.toUpperCase().trim()).eq("is_active", true).maybeSingle();
    if (error || !data) { toast.error("Invalid or expired coupon."); setCouponLoading(false); return; }
    if (data.max_uses && data.current_uses >= data.max_uses) { toast.error("Coupon usage limit reached."); setCouponLoading(false); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { toast.error("Coupon expired."); setCouponLoading(false); return; }
    setCouponApplied({ code: data.code, type: data.discount_type, value: data.discount_value });
    toast.success(`Coupon "${data.code}" applied!`);
    setCouponLoading(false);
  };

  const handleCrypto = async () => {
    if (!user) { toast.error("Please sign in first."); navigate("/auth"); return; }
    setProcessing(true);
    try {
      const purchase = await createPurchaseRecord();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/nowpayments-create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_invoice", amount: total, currency: "usd",
          description: `${stepType === "1-step" ? "1 Step" : "2 Step"} Challenge — ${accountSize}`,
          purchaseId: purchase.id, orderId: purchase.id,
        }),
      });
      const data = await res.json();
      if (data.invoiceUrl) { window.open(data.invoiceUrl, "_blank"); toast.success("Crypto payment page opened!"); }
      else toast.error(data.error || "Failed to create crypto invoice.");
    } catch (err) { toast.error("Error: " + String(err)); }
    setProcessing(false);
  };

  const handleManual = async () => {
    if (!user) { toast.error("Please sign in first."); navigate("/auth"); return; }
    setProcessing(true);
    try {
      await createPurchaseRecord();
      toast.success("Order placed! Payment is being reviewed.");
      navigate("/dashboard");
    } catch { toast.error("Something went wrong."); }
    setProcessing(false);
  };

  const stepLabel = stepType === "1-step" ? "1 Step" : "2 Step";

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>

        {/* Main Card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          {/* Order header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{stepLabel} Challenge</p>
              <p className="font-display text-lg font-bold">{accountSize}</p>
            </div>
            <div className="text-right">
              {discount > 0 && <p className="text-xs text-muted-foreground line-through">${basePrice}</p>}
              <p className="font-display text-2xl font-bold">${total}</p>
            </div>
          </div>

          {/* Coupon */}
          {couponApplied ? (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-primary" />
                <span className="text-xs font-mono font-bold">{couponApplied.code}</span>
                <span className="text-xs text-muted-foreground">
                  ({couponApplied.type === "percentage" ? `${couponApplied.value}%` : `$${couponApplied.value}`} off)
                </span>
              </div>
              <button onClick={() => { setCouponApplied(null); setCouponCode(""); }} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Coupon code"
                className="h-8 text-xs rounded-lg bg-secondary border-border font-mono uppercase" onKeyDown={(e) => e.key === "Enter" && applyCoupon()} />
              <Button onClick={applyCoupon} variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" disabled={couponLoading || !couponCode.trim()}>
                {couponLoading ? <Loader2 size={12} className="animate-spin" /> : "Apply"}
              </Button>
            </div>
          )}

          <div className="border-t border-border/50" />

          {/* Payment method tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
            {([["paypal", "PayPal", CreditCard], ["crypto", "Crypto", Bitcoin], ["manual", "Manual", Check]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setPayMethod(key as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${payMethod === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* PayPal */}
          {payMethod === "paypal" && (
            <div>
              {!user ? (
                <Button onClick={() => navigate("/auth")} variant="outline" className="w-full rounded-lg h-10 text-sm">Sign in to pay</Button>
              ) : !paypalReady ? (
                <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground text-sm">
                  <Loader2 size={14} className="animate-spin" /> Loading PayPal...
                </div>
              ) : (
                <div ref={paypalRef} className="min-h-[48px]" />
              )}
            </div>
          )}

          {/* Crypto */}
          {payMethod === "crypto" && (
            <div className="space-y-2">
              <Button onClick={handleCrypto} disabled={processing}
                className="w-full rounded-lg h-10 text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold">
                {processing ? <><Loader2 size={14} className="animate-spin" /> Creating invoice...</>
                  : <><Bitcoin size={14} /> Pay ${total} with Crypto <ExternalLink size={12} /></>}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">BTC • ETH • USDT • SOL • 200+ coins</p>
            </div>
          )}

          {/* Manual */}
          {payMethod === "manual" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Pay via crypto or bank transfer, then click below. We'll verify within 24h.</p>
              <Button onClick={handleManual} disabled={processing} variant="outline" className="w-full rounded-lg h-10 text-sm">
                {processing ? <><Loader2 size={14} className="animate-spin" /> Processing...</>
                  : <><Check size={14} /> I Have Paid — ${total}</>}
              </Button>
            </div>
          )}

          {processing && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" /> Verifying payment...
            </div>
          )}

          {/* Trust */}
          <div className="flex items-center justify-center gap-4 pt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Shield size={10} /> SSL Encrypted</span>
            <span className="flex items-center gap-1"><Check size={10} /> Instant Access</span>
            <span className="flex items-center gap-1"><Check size={10} /> 24/7 Support</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
