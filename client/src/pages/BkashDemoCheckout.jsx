import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { completeBkashDemoPurchase, getBkashDemoOrder } from "../api/credits";
import { useAuth } from "../context/AuthContext";

/**
 * When BKASH_DEMO_MODE=true, the server skips calling bKash and sends the user here after Create Payment.
 * Completing the flow runs the same wallet credit path as production Execute Payment.
 */
const normalizeWalletDigits = (raw) => String(raw || "").replace(/\D/g, "").slice(0, 11);

const isValidBkashWalletNumber = (digits) => /^01\d{9}$/.test(digits);

const maskWallet = (digits) => {
  if (digits.length < 4) return "";
  return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
};

const BkashDemoCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, setUserProfile } = useAuth();
  const orderId = searchParams.get("orderId") || "";

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [walletDigits, setWalletDigits] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    setCheckoutStep(0);
    setWalletDigits("");
    setPhoneError("");
    let cancelled = false;
    (async () => {
      if (!orderId) {
        setError("Missing order.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const { data } = await getBkashDemoOrder(orderId);
        if (!cancelled) setOrder(data.data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || "Could not load this checkout session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const handleWalletContinue = () => {
    setPhoneError("");
    const d = normalizeWalletDigits(walletDigits);
    if (!isValidBkashWalletNumber(d)) {
      setPhoneError("Enter a valid 11-digit bKash wallet number (starts with 01).");
      return;
    }
    setWalletDigits(d);
    setCheckoutStep(1);
  };

  const handleComplete = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await completeBkashDemoPurchase(orderId);
      const w = data?.data?.wallet;
      if (w && user) {
        setUserProfile({
          ...user,
          credits: Number(w.totalCredits || 0),
          totalCredits: Number(w.totalCredits || 0),
          heldCredits: Number(w.heldCredits || 0),
        });
      }
      navigate("/credits?purchase=success", { replace: true });
    } catch (e) {
      setError(e.response?.data?.message || "Payment could not be confirmed. Try again or contact support.");
    } finally {
      setBusy(false);
    }
  };

  if (!orderId) {
    return (
      <div className="bkash-checkout-page">
        <p className="error">Invalid checkout link.</p>
        <Link to="/credits" className="button bkash-checkout-page__btn">
          Back to Credit center
        </Link>
      </div>
    );
  }

  const walletMasked = maskWallet(walletDigits);

  return (
    <div className="bkash-checkout-page">
      <div className="bkash-checkout-page__strip" aria-hidden />
      <header className="bkash-checkout-page__header">
        <div>
          <p className="bkash-checkout-page__brand">bKash</p>
          <h1 className="bkash-checkout-page__title">
            {checkoutStep === 0 ? "Wallet number" : "Complete payment"}
          </h1>
          <p className="bkash-checkout-page__subtitle">
            {checkoutStep === 0
              ? "Enter the bKash wallet number you want to pay from. On the next screen you will confirm the amount."
              : "Review your order, then confirm. Your balance updates immediately after a successful payment."}
          </p>
        </div>
        <Link to="/credits" className="button button--ghost bkash-checkout-page__cancel">
          Cancel
        </Link>
      </header>

      {loading ? (
        <p className="module2-muted">Loading secure checkout…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : order?.status !== "pending" ? (
        <section className="bkash-checkout-page__card">
          <p className="module2-muted">This session is already closed. Return to the Credit center to start again.</p>
          <Link to="/credits" className="button bkash-checkout-page__btn" style={{ marginTop: "0.75rem", display: "inline-block" }}>
            Credit center
          </Link>
        </section>
      ) : checkoutStep === 0 ? (
        <section className="bkash-checkout-page__card">
          <h2 className="bkash-checkout-page__card-title">bKash wallet</h2>
          <label className="bkash-checkout-page__label" htmlFor="bkash-wallet-input">
            Mobile number
          </label>
          <input
            id="bkash-wallet-input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            className="bkash-checkout-page__input"
            placeholder="01XXXXXXXXX"
            value={walletDigits}
            onChange={(e) => setWalletDigits(normalizeWalletDigits(e.target.value))}
          />
          {phoneError ? <p className="error bkash-checkout-page__field-error">{phoneError}</p> : null}
          <button type="button" className="button bkash-checkout-page__primary" onClick={handleWalletContinue}>
            Continue
          </button>
        </section>
      ) : (
        <section className="bkash-checkout-page__card">
          <p className="bkash-checkout-page__wallet-line">
            Wallet <strong>{walletMasked}</strong>
            <button type="button" className="bkash-checkout-page__linkish" onClick={() => setCheckoutStep(0)}>
              Change
            </button>
          </p>
          <h2 className="bkash-checkout-page__card-title">Order summary</h2>
          <dl className="bkash-checkout-page__dl">
            <div>
              <dt>Amount</dt>
              <dd>
                <strong>৳{order.amountBdt}</strong>
              </dd>
            </div>
            <div>
              <dt>Credits</dt>
              <dd>{order.credits}</dd>
            </div>
            <div>
              <dt>Invoice</dt>
              <dd>
                <code className="bkash-checkout-page__code">{order.invoiceNumber}</code>
              </dd>
            </div>
            <div>
              <dt>Package</dt>
              <dd>{order.packageId}</dd>
            </div>
          </dl>
          <button type="button" className="button bkash-checkout-page__primary" disabled={busy} onClick={handleComplete}>
            {busy ? "Confirming…" : "Pay ৳" + order.amountBdt + " with bKash"}
          </button>
        </section>
      )}
    </div>
  );
};

export default BkashDemoCheckout;
