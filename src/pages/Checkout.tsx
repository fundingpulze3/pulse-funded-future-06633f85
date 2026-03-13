import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Shield,
  Check,
  X,
  Loader2,
  CreditCard,
  Bitcoin,
  ExternalLink,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useUtmTracking, getStoredUtm } from "@/hooks/useUtmTracking";

declare global {
  interface Window {
    paypal?: any;
  }
}

const accountSizes = ["$5K", "$10K", "$25K", "$50K", "$100K"];

const countries = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
  "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon",
  "Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia",
  "Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominican Republic","Ecuador","Egypt","El Salvador",
  "Estonia","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Guatemala",
  "Guinea","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Libya",
  "Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Mauritius","Mexico",
  "Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nepal","Netherlands",
  "New Zealand","Nicaragua","Niger","Nigeria","North Macedonia","Norway","Oman","Pakistan","Palestine","Panama",
  "Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal",
  "Serbia","Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","Spain","Sri Lanka","Sudan",
  "Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo","Trinidad and Tobago","Tunisia",
  "Turkey","Turkmenistan","Uganda","Ukraine","United Arab Emirates","United Kingdom","Uruguay","Uzbekistan",
  "Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
];

const Checkout = () => {
  useUtmTracking();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const paypalRef = useRef<HTMLDivElement>(null);
  const purchaseIdRef = useRef<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalLoadError, setPaypalLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const PAYPAL_CLIENT_ID = "BAAwk3bjO1bqRcrVytA9YTQC4dW6smqK2ocXDSrlDZn3pWNo2pNumzgqwzr8SwlEk7mZ4z9dpmxMCRDz5Q";

  const initialStep = searchParams.get("step") || "2-step";
  const initialSize = searchParams.get("size") || "$50K";
  const initialPrice = Number(searchParams.get("price") || "289");

  const [stepType, setStepType] = useState(initialStep);
  const [selectedSize, setSelectedSize] = useState(initialSize);
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Billing details
  const [billingOpen, setBillingOpen] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [billingLoaded, setBillingLoaded] = useState(false);

  // Load saved billing details
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("first_name, last_name, country, billing_address, city, zip_code")
      .eq("user_id", user.id).single().then(({ data }) => {
        if (data) {
          if (data.first_name) setFirstName(data.first_name);
          if (data.last_name) setLastName(data.last_name);
          if (data.country) setCountry(data.country);
          if (data.billing_address) setBillingAddress(data.billing_address);
          if (data.city) setCity(data.city);
          if (data.zip_code) setZipCode(data.zip_code);
          // If billing already filled, collapse
          if (data.first_name && data.last_name && data.country) {
            setBillingOpen(false);
          }
        }
        setBillingLoaded(true);
      });
  }, [user]);

  const [challenges, setChallenges] = useState<any[]>([]);

  useEffect(() => {
    const dbStep = stepType === "1-step" ? "one_step" : "two_step";
    supabase.from("challenges").select("*").eq("step_type", dbStep).eq("is_active", true)
      .then(({ data }) => setChallenges(data || []));
  }, [stepType]);

  const sizeNum = parseInt(selectedSize.replace(/[$,K]/gi, "")) * 1000;
  const matchedChallenge = challenges.find(c => c.account_size === sizeNum);
  const basePrice = matchedChallenge?.price ?? initialPrice;

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; type: string; value: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [payMethod, setPayMethod] = useState<"paypal" | "crypto">("paypal");

  let discount = 0;
  if (couponApplied) {
    discount = couponApplied.type === "percentage"
      ? Math.round(basePrice * (couponApplied.value / 100))
      : Math.min(couponApplied.value, basePrice);
  }
  const total = basePrice - discount;
  const totalRef = useRef(total);
  totalRef.current = total;

  const stepLabel = stepType === "1-step" ? "1 Step" : "2 Step";
  const billingFilled = firstName.trim() && lastName.trim() && country.trim();

  // Save billing details
  const saveBillingDetails = async () => {
    if (!user) return;
    await supabase.from("profiles").update({
      first_name: firstName, last_name: lastName, country,
      billing_address: billingAddress, city, zip_code: zipCode,
    }).eq("user_id", user.id);
  };

  // PayPal SDK init
  useEffect(() => {
    if (window.paypal?.Buttons) {
      setPaypalReady(true);
      setPaypalLoadError(null);
      return;
    }

    const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]') as HTMLScriptElement | null;

    const handleLoad = () => {
      if (window.paypal?.Buttons) {
        setPaypalReady(true);
        setPaypalLoadError(null);
      }
    };

    const handleError = () => {
      setPaypalReady(false);
      setPaypalLoadError("PayPal failed to load. Please refresh and try again.");
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
      script.async = true;
      script.onload = handleLoad;
      script.onerror = handleError;
      document.body.appendChild(script);
    }

    const timeout = window.setTimeout(() => {
      if (!window.paypal?.Buttons) {
        setPaypalLoadError("PayPal button is unavailable right now.");
      }
    }, 10000);

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad);
      existingScript.addEventListener("error", handleError);
    }

    return () => {
      window.clearTimeout(timeout);
      if (existingScript) {
        existingScript.removeEventListener("load", handleLoad);
        existingScript.removeEventListener("error", handleError);
      }
    };
  }, [PAYPAL_CLIENT_ID]);

  const createPurchaseRecord = useCallback(async () => {
    if (!user) throw new Error("Not signed in");
    if (!firstName || !lastName || !country) throw new Error("Please fill in billing details");
    // Save billing on purchase
    await saveBillingDetails();
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
        payment_status: "pending", status: "pending", swap_free: false,
        utm_source: utm.utm_source || null, utm_medium: utm.utm_medium || null,
        utm_campaign: utm.utm_campaign || null, utm_term: utm.utm_term || null,
        utm_content: utm.utm_content || null,
      }).select().single();
    if (error || !purchase) throw new Error("Failed to create order");
    return purchase;
  }, [user, sizeNum, stepType, firstName, lastName, country, billingAddress, city, zipCode]);

  useEffect(() => {
    if (!paypalReady || !paypalRef.current || !user || !window.paypal?.Buttons) return;
    paypalRef.current.innerHTML = "";
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    const buttons = window.paypal.Buttons({
      style: { layout: "vertical", color: "black", shape: "rect", label: "pay", height: 45 },
      onClick: (_data: any, actions: any) => {
        if (!billingFilled) {
          toast.error("Please fill billing details first.");
          return actions.reject();
        }
        if (!agreedTerms) {
          toast.error("Please agree to the terms.");
          return actions.reject();
        }
        return actions.resolve();
      },
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
                description: `${stepLabel} Challenge — ${selectedSize}`,
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
      onError: (err: any) => {
        console.error("PayPal error:", err);
        setPaypalLoadError("PayPal button is unavailable right now.");
        toast.error("PayPal payment failed.");
      },
      onCancel: () => toast.info("Payment cancelled."),
    });

    buttons.render(paypalRef.current).catch((err: unknown) => {
      console.error("PayPal render failed:", err);
      setPaypalLoadError("PayPal button is unavailable right now.");
    });

    return () => {
      try { buttons.close?.(); } catch {
        // ignore cleanup errors
      }
    };
  }, [paypalReady, user, createPurchaseRecord, stepType, selectedSize, billingFilled, agreedTerms]);

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
    if (!agreedTerms) { toast.error("Please agree to the terms."); return; }
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
          description: `${stepLabel} Challenge — ${selectedSize}`,
          purchaseId: purchase.id, orderId: purchase.id,
        }),
      });
      const data = await res.json();
      if (data.invoiceUrl) { window.open(data.invoiceUrl, "_blank"); toast.success("Crypto payment page opened!"); }
      else toast.error(data.error || "Failed to create crypto invoice.");
    } catch (err) { toast.error("Error: " + String(err)); }
    setProcessing(false);
  };



  return (
    <div className="min-h-screen bg-[hsl(230,25%,7%)] text-white">
      {/* Promo banner */}
      <div className="bg-gradient-to-r from-[hsl(260,80%,55%)] to-[hsl(280,80%,50%)] py-2.5 text-center text-xs font-medium tracking-wide">
        Haven't purchased yet? Use code <span className="font-bold">HELLO</span> & Get 20% OFF now on your first purchase!
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[hsl(220,15%,55%)] hover:text-white mb-6 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
          {/* LEFT — Configuration */}
          <div className="space-y-6">
            {/* Step Type Selector */}
            <div className="rounded-2xl border border-[hsl(220,15%,15%)] bg-[hsl(230,20%,10%)] p-6">
              <h2 className="text-lg font-bold mb-1">Challenge Type</h2>
              <p className="text-sm text-[hsl(220,15%,50%)] mb-4">Choose your evaluation path</p>
              <div className="grid grid-cols-2 gap-3">
                {(["1-step", "2-step"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStepType(s)}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                      stepType === s
                        ? "border-[hsl(230,60%,55%)] bg-[hsl(230,40%,15%)]"
                        : "border-[hsl(220,15%,15%)] bg-[hsl(230,20%,8%)] hover:border-[hsl(220,15%,25%)]"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      stepType === s ? "border-[hsl(230,60%,55%)]" : "border-[hsl(220,15%,30%)]"
                    }`}>
                      {stepType === s && <div className="w-2 h-2 rounded-full bg-[hsl(230,60%,55%)]" />}
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-semibold">{s === "1-step" ? "1 Step" : "2 Step"}</span>
                      <span className="ml-2 text-xs text-[hsl(220,15%,45%)]">
                        {s === "1-step" ? "Single phase" : "Two phases"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Account Size */}
            <div className="rounded-2xl border border-[hsl(220,15%,15%)] bg-[hsl(230,20%,10%)] p-6">
              <h2 className="text-lg font-bold mb-1">Account Size</h2>
              <p className="text-sm text-[hsl(220,15%,50%)] mb-4">Select your preferred account size</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {accountSizes.map(size => {
                  const sNum = parseInt(size.replace(/[$,K]/gi, "")) * 1000;
                  const ch = challenges.find(c => c.account_size === sNum);
                  const price = ch?.price;
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selectedSize === size
                          ? "border-[hsl(230,60%,55%)] bg-[hsl(230,40%,15%)]"
                          : "border-[hsl(220,15%,15%)] bg-[hsl(230,20%,8%)] hover:border-[hsl(220,15%,25%)]"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 mb-3 flex items-center justify-center ${
                        selectedSize === size ? "border-[hsl(230,60%,55%)]" : "border-[hsl(220,15%,30%)]"
                      }`}>
                        {selectedSize === size && <div className="w-2 h-2 rounded-full bg-[hsl(230,60%,55%)]" />}
                      </div>
                      <p className="text-base font-bold">${sNum.toLocaleString()}</p>
                      {price != null && <p className="text-xs text-[hsl(220,15%,45%)] mt-0.5">${price}</p>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Billing Details */}
            <div className="rounded-2xl border border-[hsl(220,15%,15%)] bg-[hsl(230,20%,10%)]">
              <button
                onClick={() => setBillingOpen(!billingOpen)}
                className="w-full flex items-center justify-between p-6"
              >
                <div className="text-left">
                  <h2 className="text-lg font-bold">Billing Details</h2>
                  <p className="text-sm text-[hsl(220,15%,50%)]">Enter your billing information for the challenge purchase</p>
                </div>
                {billingOpen ? <ChevronUp size={18} className="text-[hsl(220,15%,45%)]" /> : <ChevronDown size={18} className="text-[hsl(220,15%,45%)]" />}
              </button>
              {billingOpen && (
                <div className="px-6 pb-6 space-y-4 border-t border-[hsl(220,15%,12%)] pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[hsl(220,15%,70%)] mb-1.5 block">First Name</label>
                      <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First Name"
                        className="h-11 rounded-xl bg-[hsl(230,20%,8%)] border-[hsl(220,15%,15%)] text-white placeholder:text-[hsl(220,15%,30%)]" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[hsl(220,15%,70%)] mb-1.5 block">Last Name</label>
                      <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last Name"
                        className="h-11 rounded-xl bg-[hsl(230,20%,8%)] border-[hsl(220,15%,15%)] text-white placeholder:text-[hsl(220,15%,30%)]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[hsl(220,15%,70%)] mb-1.5 block">Country</label>
                    <select value={country} onChange={e => setCountry(e.target.value)}
                      className="w-full h-11 rounded-xl bg-[hsl(230,20%,8%)] border border-[hsl(220,15%,15%)] text-white px-3 text-sm appearance-none">
                      <option value="">Select country</option>
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[hsl(220,15%,70%)] mb-1.5 block">Billing Address</label>
                    <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="Street address"
                      className="h-11 rounded-xl bg-[hsl(230,20%,8%)] border-[hsl(220,15%,15%)] text-white placeholder:text-[hsl(220,15%,30%)]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[hsl(220,15%,70%)] mb-1.5 block">City</label>
                      <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City"
                        className="h-11 rounded-xl bg-[hsl(230,20%,8%)] border-[hsl(220,15%,15%)] text-white placeholder:text-[hsl(220,15%,30%)]" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[hsl(220,15%,70%)] mb-1.5 block">ZIP / Postal Code</label>
                      <Input value={zipCode} onChange={e => setZipCode(e.target.value)} placeholder="ZIP Code"
                        className="h-11 rounded-xl bg-[hsl(230,20%,8%)] border-[hsl(220,15%,15%)] text-white placeholder:text-[hsl(220,15%,30%)]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Order Summary */}
          <div className="space-y-4 lg:sticky lg:top-8 self-start">
            {/* Coupon */}
            <div className="rounded-2xl border border-[hsl(220,15%,15%)] bg-[hsl(230,20%,10%)] p-5">
              <h3 className="text-sm font-bold mb-1">Coupon Code</h3>
              <p className="text-xs text-[hsl(220,15%,45%)] mb-3">Enter a coupon code to get a discount on your challenge</p>
              {couponApplied ? (
                <div className="flex items-center justify-between bg-[hsl(142,60%,50%)]/10 border border-[hsl(142,60%,50%)]/20 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-[hsl(142,60%,50%)]" />
                    <span className="text-xs font-mono font-bold">{couponApplied.code}</span>
                    <span className="text-xs text-[hsl(220,15%,45%)]">
                      ({couponApplied.type === "percentage" ? `${couponApplied.value}%` : `$${couponApplied.value}`} off)
                    </span>
                  </div>
                  <button onClick={() => { setCouponApplied(null); setCouponCode(""); }} className="text-[hsl(220,15%,45%)] hover:text-[hsl(0,70%,55%)]"><X size={14} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon code"
                    className="h-10 text-sm rounded-xl bg-[hsl(230,20%,8%)] border-[hsl(220,15%,15%)] text-white font-mono uppercase placeholder:text-[hsl(220,15%,30%)] placeholder:normal-case"
                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                  />
                  <Button
                    onClick={applyCoupon}
                    variant="outline"
                    className="h-10 rounded-xl px-5 text-sm border-[hsl(220,15%,20%)] text-white hover:bg-[hsl(220,15%,15%)]"
                    disabled={couponLoading || !couponCode.trim()}
                  >
                    {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                  </Button>
                </div>
              )}
            </div>

            {/* Order Summary Card */}
            <div className="rounded-2xl border border-[hsl(230,60%,55%)]/30 bg-[hsl(230,20%,10%)] p-5 shadow-[0_0_30px_-10px_hsl(230,60%,55%,0.2)]">
              <h3 className="text-lg font-bold mb-4">Order Summary</h3>
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[hsl(220,15%,60%)]">
                    ${sizeNum.toLocaleString()} — {stepLabel} Funding Pulze
                  </span>
                  <span className="text-sm font-semibold">${basePrice.toFixed(2)}</span>
                </div>
                <p className="text-xs text-[hsl(220,15%,40%)]">Platform: MetaTrader 5</p>
                {discount > 0 && (
                  <div className="flex items-center justify-between text-sm text-[hsl(142,60%,50%)]">
                    <span>Discount ({couponApplied?.code})</span>
                    <span className="font-semibold">-${discount.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-[hsl(220,15%,15%)] pt-3 flex items-center justify-between">
                <span className="text-base font-bold">Total</span>
                <span className="text-2xl font-bold text-[hsl(142,60%,50%)]">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Terms */}
            <div className="rounded-2xl border border-[hsl(220,15%,15%)] bg-[hsl(230,20%,10%)] p-5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={agreedTerms}
                  onCheckedChange={(v) => setAgreedTerms(!!v)}
                  className="mt-0.5 border-[hsl(220,15%,25%)] data-[state=checked]:bg-[hsl(230,60%,55%)] data-[state=checked]:border-[hsl(230,60%,55%)]"
                />
                <label htmlFor="terms" className="text-xs text-[hsl(220,15%,55%)] leading-relaxed cursor-pointer">
                  <span className="font-semibold text-white block mb-1.5">I agree with all the following terms:</span>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>I have read and agreed to the <a href="/terms" className="text-[hsl(230,60%,65%)] hover:underline">Terms of Use</a>.</li>
                    <li>All information provided is correct and matches government-issued ID.</li>
                    <li>I have read and agree with the <a href="/terms" className="text-[hsl(230,60%,65%)] hover:underline">Terms & Conditions</a>.</li>
                    <li>I confirm that I am not a U.S. citizen or resident.</li>
                  </ul>
                </label>
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-3">
              <div className="flex gap-1 p-1 rounded-xl bg-[hsl(230,20%,8%)] border border-[hsl(220,15%,15%)]">
                {([["paypal", "PayPal", CreditCard], ["crypto", "Crypto", Bitcoin], ["manual", "Manual", Check]] as const).map(([key, label, Icon]) => (
                  <button key={key} onClick={() => setPayMethod(key as any)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      payMethod === key
                        ? "bg-[hsl(230,20%,15%)] text-white shadow-sm"
                        : "text-[hsl(220,15%,45%)] hover:text-white"
                    }`}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>

              {!billingFilled && (
                <p className="text-xs text-[hsl(0,70%,55%)] text-center">Please fill in billing details first</p>
              )}

              {payMethod === "paypal" && (
                <div>
                  {!user ? (
                    <Button onClick={() => navigate("/auth")} className="w-full rounded-xl h-12 text-sm bg-[hsl(230,60%,55%)] hover:bg-[hsl(230,60%,50%)] text-white font-semibold">
                      Sign in to Continue
                    </Button>
                  ) : paypalLoadError ? (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {paypalLoadError}
                    </div>
                  ) : !paypalReady ? (
                    <div className="flex items-center justify-center py-4 gap-2 text-[hsl(220,15%,45%)] text-sm">
                      <Loader2 size={14} className="animate-spin" /> Loading PayPal...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div ref={paypalRef} className="min-h-[48px]" />
                      {(!agreedTerms || !billingFilled) && (
                        <p className="text-[10px] text-[hsl(220,15%,45%)] text-center">
                          Complete billing details and accept terms before clicking PayPal.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {payMethod === "crypto" && (
                <div className="space-y-2">
                  <Button onClick={handleCrypto} disabled={processing || !agreedTerms || !billingFilled}
                    className="w-full rounded-xl h-12 text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold">
                    {processing ? <><Loader2 size={14} className="animate-spin" /> Creating invoice...</>
                      : <><Bitcoin size={14} /> Pay ${total.toFixed(2)} with Crypto <ExternalLink size={12} /></>}
                  </Button>
                  <p className="text-[10px] text-[hsl(220,15%,40%)] text-center">BTC • ETH • USDT • SOL • 200+ coins</p>
                </div>
              )}

              {payMethod === "manual" && (
                <div className="space-y-2">
                  <p className="text-xs text-[hsl(220,15%,45%)]">Pay via crypto or bank transfer, then click below. We'll verify within 24h.</p>
                  <Button onClick={handleManual} disabled={processing || !agreedTerms || !billingFilled}
                    className="w-full rounded-xl h-12 text-sm bg-[hsl(230,20%,15%)] hover:bg-[hsl(230,20%,20%)] text-white border border-[hsl(220,15%,20%)] font-semibold">
                    {processing ? <><Loader2 size={14} className="animate-spin" /> Processing...</>
                      : <><Check size={14} /> I Have Paid — ${total.toFixed(2)}</>}
                  </Button>
                </div>
              )}

              {processing && (
                <div className="flex items-center justify-center gap-2 text-xs text-[hsl(220,15%,45%)]">
                  <Loader2 size={12} className="animate-spin" /> Verifying payment...
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-5 pt-1 text-[10px] text-[hsl(220,15%,40%)]">
              <span className="flex items-center gap-1"><Shield size={10} /> SSL Encrypted</span>
              <span className="flex items-center gap-1"><Check size={10} /> Instant Access</span>
              <span className="flex items-center gap-1"><Check size={10} /> 24/7 Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
