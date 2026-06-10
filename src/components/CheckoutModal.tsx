import React from "react";
import { Check, CreditCard, ChevronRight, AlertCircle, ShoppingBag, X, RefreshCw, Send, Sparkles, Smartphone } from "lucide-react";
import { Cart, CartItem } from "../types";

interface CheckoutModalProps {
  cart: Cart;
  token: string | null;
  onClose: () => void;
  onOrderSuccess: (orderId: string) => void;
}

export default function CheckoutModal({ cart, token, onClose, onOrderSuccess }: CheckoutModalProps) {
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // User wallet balance cached status
  const [walletBalance, setWalletBalance] = React.useState(0);
  const [loadingBalance, setLoadingBalance] = React.useState(false);

  // Step 2: Shipping
  const [shippingName, setShippingName] = React.useState("");
  const [shippingStreet, setShippingStreet] = React.useState("");
  const [shippingCity, setShippingCity] = React.useState("Accra");
  const [shippingPostal, setShippingPostal] = React.useState("GA-184-209");
  const [shippingCountry, setShippingCountry] = React.useState("Ghana");
  const [shippingPhone, setShippingPhone] = React.useState("");

  // Step 3: Payment
  const [paymentMethod, setPaymentMethod] = React.useState<"wallet" | "paystack">("wallet");
  const [momoProvider, setMomoProvider] = React.useState<"mtn" | "telecel" | "airteltigo">("mtn");
  const [momoNumber, setMomoNumber] = React.useState("");

  // Deposit/Top-up triggers
  const [depositAmount, setDepositAmount] = React.useState("");
  const [pendingTopup, setPendingTopup] = React.useState(false);

  const fetchUserBalance = React.useCallback(async () => {
    if (!token) return;
    setLoadingBalance(true);
    try {
      const sellerProfileToken = token.replace("auth-session-", "");
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        const me = list.find((u: any) => u.id === sellerProfileToken);
        if (me) {
          setWalletBalance(me.walletBalance || 0);
        }
      }
    } catch (e) {
      console.log("Failed to load customer balance.");
    } finally {
      setLoadingBalance(false);
    }
  }, [token]);

  React.useEffect(() => {
    fetchUserBalance();
  }, [fetchUserBalance]);

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!shippingName || !shippingStreet || !shippingCity || !shippingPhone) {
        setError("Please complete all shipping address attributes.");
        return;
      }
      setError(null);
      setStep(3);
    } else if (step === 3) {
      if (paymentMethod === "wallet" && walletBalance < cart.total) {
        setError(`Insufficient wallet funds. You require GH₵ ${cart.total.toFixed(2)} but only have GH₵ ${walletBalance.toFixed(2)}. Please top up your wallet using Paystack below.`);
        return;
      }
      setError(null);
      setStep(4);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep((step - 1) as any);
    }
  };

  // Deposit sum instantly using Paystack simulator integrations
  const handleTriggerDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;

    setPendingTopup(true);
    try {
      // 1. Initialize Paystack transfer link
      const paystackRes = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(depositAmount),
          email: "customer@dataghmart.com"
        })
      });

      const paystackData = await paystackRes.json();
      if (!paystackRes.ok) {
        throw new Error(paystackData.error || "Failed initializing Paystack gateway.");
      }

      alert(`Redirecting to Paystack secure verification... Reference: ${paystackData.reference}`);

      // 2. Clear deposit on server wallet mock
      const depositRes = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: parseFloat(depositAmount) })
      });

      if (depositRes.ok) {
        alert(`GH₵ ${parseFloat(depositAmount).toFixed(2)} has been successfully credited via Paystack!`);
        setDepositAmount("");
        fetchUserBalance();
      }
    } catch (err: any) {
      alert(err.message || "Topup error occurred.");
    } finally {
      setPendingTopup(false);
    }
  };

  const handlePlaceOrder = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Paystack direct payment option
      if (paymentMethod === "paystack") {
        // Redirection simulated link API initialize
        const paystackRes = await fetch("/api/paystack/initialize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            amount: cart.total,
            email: "pay@dataghmart.com"
          })
        });

        const paystackData = await paystackRes.json();
        if (!paystackRes.ok) {
          throw new Error(paystackData.error || "Paystack initialization failed.");
        }

        alert(`Processing securely via Paystack link: ${paystackData.authorizationUrl}. Automatically finishing checkout...`);
      }

      // Record final order on Dataghmart server system
      const payload = {
        shippingAddress: {
          name: shippingName,
          street: shippingStreet,
          city: shippingCity,
          postalCode: shippingPostal || "GA-111",
          country: shippingCountry,
          phone: shippingPhone
        },
        paymentMethod: paymentMethod === "paystack" ? "Paystack Mobile Money" : "Dataghmart Wallet",
        notes: `Mobile details: ${paymentMethod === "paystack" ? momoProvider + " - " + momoNumber : "Wallet"}`
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit order checkout.");
      }

      onOrderSuccess(data.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="checkout-modal-backdrop" className="fixed inset-0 z-55 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div id="checkout-modal-window" className="bg-white rounded-2xl border border-neutral-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header bar */}
        <div className="px-6 py-4.5 border-b border-neutral-150 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-neutral-900" />
            <h3 className="font-sans font-bold text-base text-neutral-900">Dataghmart Secure Checkout</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 cursor-pointer">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Custom Progress Stepper row */}
        <div id="checkout-stepper" className="px-8 py-4.5 bg-neutral-50/50 border-b border-neutral-100 flex items-center justify-between">
          {[
            { num: 1, label: "Bag Review" },
            { num: 2, label: "Dispatch Address" },
            { num: 3, label: "Billing & topup" },
            { num: 4, label: "Verification success" }
          ].map(s => (
            <div key={s.num} className="flex items-center gap-2">
              <span className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-sans font-bold ${
                step === s.num ? "bg-neutral-900 text-white" : step > s.num ? "bg-neutral-200 text-neutral-700" : "bg-neutral-100 text-neutral-400"
              }`}>
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </span>
              <span className={`hidden sm:inline font-sans text-[11px] font-medium tracking-tight ${
                step === s.num ? "text-neutral-900 font-semibold" : "text-neutral-400"
              }`}>
                {s.label}
              </span>
              {s.num < 4 && <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-neutral-200" />}
            </div>
          ))}
        </div>

        {/* Global error banner */}
        {error && (
          <div id="checkout-error-banner" className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2.5 text-red-700 font-sans text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Inner Panel state router */}
        <div className="p-6 sm:p-8 max-h-[55vh] overflow-y-auto">
          
          {/* STEP 1: REVIEW ITEMS */}
          {step === 1 && (
            <div id="pane-bag-review" className="space-y-4 animate-in fade-in duration-250">
              <span className="font-sans text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Bag items list</span>
              <div className="divide-y divide-neutral-100 max-h-56 overflow-y-auto pr-1">
                {cart.items.map((item: CartItem) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-11 h-11 rounded-lg object-cover bg-neutral-100"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex flex-col">
                        <span className="font-sans font-semibold text-xs text-neutral-950 max-w-44 sm:max-w-72 truncate">{item.name}</span>
                        <span className="font-sans text-[10px] text-neutral-500 mt-0.5">Quantity: {item.quantity} units</span>
                      </div>
                    </div>
                    <span className="font-sans font-semibold text-xs text-neutral-900">GH₵ {item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-100 pt-4 flex flex-col items-end gap-1 font-sans text-xs">
                <span className="text-neutral-500 block">Bag Subtotal: <span className="font-bold text-neutral-900">GH₵ {cart.subtotal.toFixed(2)}</span></span>
                <span className="text-neutral-500 mt-1 block font-bold text-neutral-900 text-sm">Est. Total: <span className="text-neutral-900">GH₵ {cart.total.toFixed(2)}</span></span>
              </div>
            </div>
          )}

          {/* STEP 2: SHIPPING INPUT */}
          {step === 2 && (
            <div id="pane-shipping-input" className="space-y-4 animate-in fade-in duration-250">
              <span className="font-sans text-xs font-semibold text-neutral-400 uppercase tracking-wider block font-bold">Ghana Host Delivery Address</span>
              
              <div className="space-y-3">
                <div>
                  <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Kwame Mensah"
                    value={shippingName}
                    onChange={(e) => setShippingName(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 outline-none focus:border-neutral-950"
                  />
                </div>

                <div>
                  <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1 font-bold">Street Location Road *</label>
                  <input
                    type="text"
                    required
                    placeholder="Oxford Street, Osu"
                    value={shippingStreet}
                    onChange={(e) => setShippingStreet(e.target.value)}
                    className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 outline-none focus:border-neutral-950"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Ghana City / Region *</label>
                    <select
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 outline-none focus:border-neutral-950 bg-white"
                    >
                      <option value="Accra">Accra (Greater Accra)</option>
                      <option value="Kumasi">Kumasi (Ashanti Region)</option>
                      <option value="Takoradi">Takoradi (Western Region)</option>
                      <option value="Tamale">Tamale (Northern Region)</option>
                      <option value="Cape Coast">Cape Coast (Central Region)</option>
                      <option value="Koforidua">Koforidua (Eastern Region)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Postal / Digital Address</label>
                    <input
                      type="text"
                      placeholder="e.g. GA-184-2090"
                      value={shippingPostal}
                      onChange={(e) => setShippingPostal(e.target.value)}
                      className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 outline-none focus:border-neutral-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">Country</label>
                    <input
                      type="text"
                      disabled
                      value="Ghana"
                      className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-100 bg-neutral-50 text-neutral-400 outline-none cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">MoMo Contact Phone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +233 24 123 4567"
                      value={shippingPhone}
                      onChange={(e) => setShippingPhone(e.target.value)}
                      className="w-full font-sans text-xs p-2.5 rounded-xl border border-neutral-200 outline-none focus:border-neutral-950"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: BILLING CONFIGURATION */}
          {step === 3 && (
            <div id="pane-billing" className="space-y-4 animate-in fade-in duration-250">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-semibold text-neutral-400 uppercase tracking-wider block font-bold">Select Billing Gateway</span>
                <span className="font-sans text-xs font-semibold text-neutral-800">Your Wallet: <span className="font-mono font-bold text-emerald-600">GH₵{walletBalance.toFixed(2)}</span></span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("wallet")}
                  className={`p-4 rounded-xl border font-sans text-xs text-left cursor-pointer transition-all ${
                    paymentMethod === "wallet" ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-emerald-600 mb-2.5" />
                  <span className="font-semibold text-neutral-900 block">Dataghmart Wallet</span>
                  <span className="text-[10px] text-neutral-450 block mt-0.5">Pay using GH₵ account.</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setPaymentMethod("paystack");
                    setError(null);
                  }}
                  className={`p-4 rounded-xl border font-sans text-xs text-left cursor-pointer transition-all ${
                    paymentMethod === "paystack" ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-amber-600 mb-2.5" />
                  <span className="font-semibold text-neutral-900 block">Paystack Instant (MoMo)</span>
                  <span className="text-[10px] text-neutral-450 block mt-0.5">Redirection checkout.</span>
                </button>
              </div>

              {paymentMethod === "wallet" ? (
                <div id="wallet-checkout-pane" className="p-4 rounded-xl bg-neutral-50 border border-neutral-150 space-y-3">
                  <div className="flex justify-between text-xs font-sans">
                    <span className="text-neutral-500">Active Wallet Balance:</span>
                    <span className="font-bold text-neutral-900">GH₵ {walletBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-sans border-b border-neutral-200 pb-2">
                    <span className="text-neutral-500">Fulfillment Cost:</span>
                    <span className="font-bold text-rose-600">GH₵ {cart.total.toFixed(2)}</span>
                  </div>
                  
                  {walletBalance < cart.total ? (
                    <div className="space-y-3 pt-1">
                      <span className="text-[11px] font-sans text-amber-700 block bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                        ⚠ Your wallet has insufficient funds of GH₵ {(cart.total - walletBalance).toFixed(2)}. Please authorize secure deposit via Paystack below:
                      </span>
                      
                      <form onSubmit={handleTriggerDeposit} className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Sum (GH₵)"
                          required
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="w-1/2 p-2 rounded-lg border border-neutral-300 font-sans text-xs bg-white outline-none focus:border-neutral-950"
                        />
                        <button
                          type="submit"
                          disabled={pendingTopup}
                          className="flex-1 bg-amber-500 text-white font-sans font-bold text-xs rounded-lg hover:bg-amber-650 cursor-pointer flex items-center justify-center gap-1"
                        >
                          {pendingTopup ? <RefreshCw className="w-3 animate-spin" /> : <Send className="w-3" />}
                          Topup with Paystack
                        </button>
                      </form>
                    </div>
                  ) : (
                    <span className="text-[10px] font-sans text-emerald-700 block font-semibold">
                      ✔ Funds are sufficient! Proceeds will instantly clear to product vendors minus a 5.5% platform commission.
                    </span>
                  )}
                </div>
              ) : (
                <div id="paystack-checkout-pane" className="p-4 rounded-xl bg-amber-50/50 border border-amber-150 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="font-sans font-bold text-xs text-amber-900">Paystack Mobile Money Integration</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="font-sans text-[9px] font-bold text-amber-800 uppercase block mb-1">Mobile Provider</label>
                      <select
                        value={momoProvider}
                        onChange={(e) => setMomoProvider(e.target.value as any)}
                        className="w-full font-sans text-xs p-2 rounded-lg border border-amber-200 outline-none bg-white"
                      >
                        <option value="mtn">MTN MoMo Ghana</option>
                        <option value="telecel">Telecel Cash</option>
                        <option value="airteltigo">AT Money (AirtelTigo)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-sans text-[9px] font-bold text-amber-800 uppercase block mb-1">MoMo Access phone number</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 024XXXXXXX"
                        value={momoNumber}
                        onChange={(e) => setMomoNumber(e.target.value)}
                        className="w-full font-sans text-xs p-2 rounded-lg border border-amber-200 outline-none bg-white"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] font-sans text-amber-800 block text-neutral-500 leading-relaxed">
                    Once clicked, Paystack API will initialize a secure payment request. Credit card, bank transfer, or Mobile Money prompt occurs instantly.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: FINAL RECOGNITION SUMMARY */}
          {step === 4 && (
            <div id="pane-final-review" className="space-y-6 animate-in fade-in duration-250">
              <span className="font-sans text-xs font-semibold text-neutral-400 uppercase tracking-wider block font-bold">Checkout Dispatch Audit</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-gray-100 pb-5">
                <div className="space-y-1.5 text-xs">
                  <span className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">Dispatch Destination</span>
                  <p className="font-sans font-semibold text-neutral-800 leading-relaxed">
                    {shippingName} <br />
                    {shippingStreet} <br />
                    {shippingCity} Region, {shippingCountry}
                  </p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <span className="font-sans text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">Selected Billing Method</span>
                  <p className="font-sans font-semibold text-neutral-800 leading-relaxed capitalize">
                    {paymentMethod === "paystack" ? "Paystack Mobile Money (" + momoProvider + ")" : "Dataghmart Wallet Balance"} <br />
                    Contact: {shippingPhone}
                  </p>
                </div>
              </div>

              <div id="summary-fee-sheet" className="space-y-2 font-sans text-xs border-b border-gray-100 pb-5">
                <div className="flex justify-between text-neutral-500">
                  <span>Bag Items Totals</span>
                  <span className="font-bold">GH₵ {cart.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Ghana Nationwide Dispatch Shipping</span>
                  <span className="text-emerald-600 font-bold">Free</span>
                </div>
              </div>

              <div className="flex justify-between items-center font-sans">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Estimated Total</span>
                <span className="text-lg font-bold text-neutral-900">GH₵ {cart.total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 flex justify-between col-span-2">
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={step === 1 || submitting}
            className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-sans font-semibold text-neutral-600 hover:text-neutral-900 disabled:opacity-30 transition-all cursor-pointer"
          >
            Previous
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2 rounded-xl bg-neutral-900 text-xs font-sans font-semibold text-white hover:bg-neutral-850 shadow-sm transition-all cursor-pointer select-none"
            >
              Next Step
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-xs font-sans font-bold text-white rounded-xl shadow-md disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
            >
              {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Buy Now (GH₵)
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
