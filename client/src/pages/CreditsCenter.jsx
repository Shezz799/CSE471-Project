import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getCreditStoreData, getMyCreditLedger, redeemGift, startBkashPurchase } from "../api/credits";

const CreditsCenter = () => {
  const { user, setUserProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [wallet, setWallet] = useState({ totalCredits: 0, heldCredits: 0 });
  const [packages, setPackages] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [paymentInfo, setPaymentInfo] = useState({
    bkash: { configured: false, callbackOriginSet: false },
    bkashDemoModeEnabled: false,
  });
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [postRedeemPath, setPostRedeemPath] = useState(null);

  const refresh = async () => {
    const [storeRes, ledgerRes] = await Promise.all([getCreditStoreData(), getMyCreditLedger({ limit: 20 })]);
    const payload = storeRes.data.data;
    setWallet(payload.wallet || { totalCredits: 0, heldCredits: 0 });
    setPackages(payload.packages || []);
    setGifts(payload.gifts || []);
    setPaymentInfo((prev) => ({
      bkash: payload.payment?.bkash || prev.bkash || { configured: false, callbackOriginSet: false },
      bkashDemoModeEnabled: Boolean(
        payload.payment?.bkashDemoModeEnabled ?? prev.bkashDemoModeEnabled
      ),
    }));
    setLedger(ledgerRes.data.data || []);
    if (user) {
      setUserProfile({
        ...user,
        credits: Number(payload.wallet?.totalCredits || 0),
        totalCredits: Number(payload.wallet?.totalCredits || 0),
        heldCredits: Number(payload.wallet?.heldCredits || 0),
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch {
        if (!cancelled) setMessage("Could not load credit center right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const p = searchParams.get("purchase");
    if (!p) return;
    if (p === "success") {
      setMessage("Payment completed — credits were added to your wallet.");
    }
    else if (p === "failed") setMessage("Payment did not complete. No credits were added.");
    else if (p === "cancelled") setMessage("Payment was cancelled at bKash.");
    else if (p === "error") setMessage("Something went wrong while confirming payment. Check your wallet balance or try again.");
    else setMessage(`Payment status: ${p}`);
  }, [searchParams]);

  const bkashReady = paymentInfo.bkash?.configured && paymentInfo.bkash?.callbackOriginSet;
  const demoCheckoutEnabled = Boolean(paymentInfo.bkashDemoModeEnabled);
  const purchaseStartLabel = demoCheckoutEnabled ? "Continue with bKash" : bkashReady ? "Pay with bKash" : "Start purchase";

  const handleBkashPurchase = async (packId) => {
    setBusyId(`bkash:${packId}`);
    setMessage("");
    setPostRedeemPath(null);
    try {
      const { data } = await startBkashPurchase({ packageId: packId });
      const d = data?.data;
      if (d?.demoMode && d?.orderId) {
        navigate(`/credits/bkash-demo?orderId=${d.orderId}`);
        return;
      }
      const url = d?.bkashURL;
      if (!url) {
        setMessage("Could not start bKash checkout (missing payment URL).");
        return;
      }
      window.location.assign(url);
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not start bKash checkout");
    } finally {
      setBusyId("");
    }
  };

  const handleRedeem = async (giftId) => {
    setBusyId(`redeem:${giftId}`);
    setMessage("");
    setPostRedeemPath(null);
    try {
      const { data } = await redeemGift({ giftId });
      await refresh();
      setPostRedeemPath(data?.data?.accessPath || null);
      setMessage("Gift redeemed.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Redemption failed");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="module2-page">
      <header className="module2-page__header">
        <div>
          <h1 className="module2-page__title">Credit center</h1>
          <p className="module2-page__subtitle">Buy credits, redeem student gifts, and track wallet activity.</p>
        </div>
        <Link to="/dashboard" className="button module2-page__back">
          Back to dashboard
        </Link>
      </header>

      {loading ? (
        <p className="module2-muted">Loading…</p>
      ) : (
        <>
          <section className="card module2-card" style={{ marginBottom: "1rem" }}>
            <h2 className="module2-card__title">Wallet</h2>
            <p className="module2-muted">
              Available: <strong>{wallet.totalCredits}</strong> credits
              {wallet.heldCredits ? ` · Held in active sessions: ${wallet.heldCredits}` : ""}
            </p>
            {message ? (
              <p
                className={
                  /could not|not configured|disabled|error|failed|cancelled|wrong/i.test(message)
                    ? "error"
                    : "module2-success"
                }
              >
                {message}
              </p>
            ) : null}
            {postRedeemPath ? (
              <p className="module2-success" style={{ marginTop: "0.5rem" }}>
                <Link to={postRedeemPath}>Open access hub</Link>
              </p>
            ) : null}
          </section>

          <section className="card module2-card" style={{ marginBottom: "1rem" }}>
            <h2 className="module2-card__title">Purchase credits</h2>
            <ul className="module2-list">
              {packages.map((pack) => (
                <li key={pack.id} className="module2-list-item">
                  <strong>{pack.label}</strong> · {pack.credits} credits · ৳{pack.priceBdt}
                  <div style={{ marginTop: "0.6rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="button"
                      disabled={busyId === `bkash:${pack.id}`}
                      onClick={() => handleBkashPurchase(pack.id)}
                    >
                      {busyId === `bkash:${pack.id}` ? "Starting…" : purchaseStartLabel}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card module2-card" style={{ marginBottom: "1rem" }}>
            <h2 className="module2-card__title">Redeem gifts</h2>
            <ul className="module2-list">
              {gifts.map((gift) => (
                <li key={gift.id} className="module2-list-item">
                  <strong>{gift.label}</strong> ({gift.durationDays} day{gift.durationDays === 1 ? "" : "s"}) ·{" "}
                  {gift.costCredits} credits
                  <div style={{ marginTop: "0.6rem" }}>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={busyId === `redeem:${gift.id}`}
                      onClick={() => handleRedeem(gift.id)}
                    >
                      {busyId === `redeem:${gift.id}` ? "Redeeming..." : "Redeem"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card module2-card">
            <h2 className="module2-card__title">Recent wallet activity</h2>
            {ledger.length === 0 ? (
              <p className="module2-muted">No credit transactions yet.</p>
            ) : (
              <ul className="module2-list">
                {ledger.map((entry) => (
                  <li key={entry._id} className="module2-list-item">
                    <strong>{entry.type.replace(/_/g, " ")}</strong> · {entry.amount > 0 ? "+" : ""}
                    {entry.amount} credits · balance {entry.balanceAfter}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default CreditsCenter;
