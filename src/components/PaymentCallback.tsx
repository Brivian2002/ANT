import React from "react";
import { CheckCircle, XCircle, RefreshCw, ArrowRight, Wallet, ShieldCheck, HelpCircle } from "lucide-react";

interface PaymentCallbackProps {
  token: string | null;
  onNavigate: (tab: string) => void;
  onRefreshUser: () => void;
}

export default function PaymentCallback({ token, onNavigate, onRefreshUser }: PaymentCallbackProps) {
  const [loading, setLoading] = React.useState(true);
  const [success, setSuccess] = React.useState<boolean | null>(null);
  const [amount, setAmount] = React.useState<number | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [trxRef, setTrxRef] = React.useState("");

  React.useEffect(() => {
    const runVerification = async () => {
      // 1. Grabs reference parameter from global location query
      const searchParams = new URLSearchParams(window.location.search);
      const reference = searchParams.get("reference") || searchParams.get("trxref");
      const urlAmount = searchParams.get("amount"); // for simulation fallback helper
      
      if (!reference) {
        setLoading(false);
        setSuccess(false);
        setErrorMsg("No transaction reference found in callback parameters.");
        return;
      }

      setTrxRef(reference);

      if (!token) {
        setLoading(false);
        setSuccess(false);
        setErrorMsg("Session token is not active. Please sign in to verify your topup.");
        return;
      }

      try {
        let verifyUrl = `/api/paystack/verify/${encodeURIComponent(reference)}`;
        if (urlAmount) {
          verifyUrl += `?amount=${encodeURIComponent(urlAmount)}`;
        }

        const res = await fetch(verifyUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        const data = await res.json();
        
        if (res.ok && data.status === "success") {
          setSuccess(true);
          setAmount(data.amount || null);
          onRefreshUser(); // fetch the updated wallet balance instantly
        } else {
          setSuccess(false);
          setErrorMsg(data.error || "The gateway refused to verify payment or it is still pending.");
        }
      } catch (err: any) {
        setSuccess(false);
        setErrorMsg(err.message || "A network error occurred contacting our payment gateway service.");
      } finally {
        setLoading(false);
        
        // Clean query parameters from URL silently so refresh doesn't trigger duplicate events
        try {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } catch (e) {
          console.warn("Could not sweep URL query string state.", e);
        }
      }
    };

    runVerification();
  }, [token, onRefreshUser]);

  return (
    <div className="max-w-xl mx-auto my-16 px-4">
      <div className="bg-white rounded-2xl border border-neutral-105 shadow-xl p-8 sm:p-10 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {loading ? (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto border border-neutral-100 relative">
              <RefreshCw className="w-8 h-8 text-neutral-800 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-sans font-bold text-lg text-neutral-900">Verifying Transaction</h3>
              <p className="font-sans text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Contacting Paystack gateway networks to audit receipt and deposit secure mobile money credits...
              </p>
            </div>
            {trxRef && (
              <div className="bg-neutral-50 rounded-lg p-2 max-w-xs mx-auto">
                <span className="font-mono text-[9px] text-neutral-400 select-none block uppercase">Reference Token</span>
                <span className="font-mono text-[10px] text-neutral-750 font-bold block truncate">{trxRef}</span>
              </div>
            )}
          </div>
        ) : success ? (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100 pulse">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h3 className="font-sans font-bold text-xl text-neutral-900">Deposit Authorized!</h3>
              <p className="font-sans text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Excellent! Your digital payment was captured. The funds were instantly cleared and credited to your personal wallet account.
              </p>
            </div>

            {amount !== null && (
              <div className="py-4 px-6 bg-neutral-50/70 border border-neutral-100 rounded-2xl max-w-xs mx-auto flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600 font-bold" />
                  <span className="font-sans font-medium text-[11px] text-neutral-500 uppercase tracking-tight block">Fulfillment Added</span>
                </div>
                <div className="text-right">
                  <span className="font-sans font-extrabold text-neutral-900">GH₵ {amount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {trxRef && (
              <div className="text-left bg-neutral-50/50 p-3.5 rounded-xl max-w-md mx-auto space-y-1 text-[10px]">
                <div className="flex justify-between border-b border-neutral-100 pb-1.5">
                  <span className="text-neutral-400">Gateway Provider</span>
                  <span className="font-semibold text-neutral-700">Paystack Mobile Money</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-neutral-400">Transaction ID</span>
                  <span className="font-mono text-[9px] text-neutral-600 font-semibold max-w-44 truncate">{trxRef}</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => onNavigate("home")}
                className="px-5 py-2.5 rounded-xl border border-neutral-200 text-xs font-sans font-semibold text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                Go to Storefront
              </button>
              <button
                onClick={() => onNavigate("wallet")}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-xs font-sans font-bold text-white cursor-pointer transition-all flex items-center justify-center gap-1 shadow-md"
              >
                View Wallet Balance
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-red-400/10 rounded-full flex items-center justify-center mx-auto border border-red-200/50">
              <XCircle className="w-9 h-9 text-red-650" />
            </div>

            <div className="space-y-2">
              <h3 className="font-sans font-bold text-xl text-neutral-900">Verification Rejected</h3>
              <p className="font-sans text-xs text-red-700 max-w-sm mx-auto leading-relaxed">
                {errorMsg || "The transaction could not be processed successfully. If you have been debited, please contact the administrators."}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50/50 text-[10px] text-neutral-400 leading-normal max-w-md mx-auto flex gap-2 text-left">
              <HelpCircle className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
              <span>
                To check active balances after any bank credit or Mobile Money debit alerts, inspect your statement log inside your private portal card.
              </span>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => onNavigate("home")}
                className="px-6 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-xs font-sans font-bold text-white cursor-pointer transition-all shadow-md"
              >
                Return to Storefront
              </button>
            </div>
          </div>
        )}

        {/* Security badge footer */}
        <div className="pt-4 border-t border-neutral-100 flex items-center justify-center gap-1.5 text-neutral-400 text-[10px] font-sans">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Paystack Certified Secure Encryption</span>
        </div>

      </div>
    </div>
  );
}
