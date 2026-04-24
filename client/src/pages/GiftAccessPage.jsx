import { Link, useParams, useSearchParams } from "react-router-dom";

const PRODUCT_UI = {
  chatgpt: {
    productName: "ChatGPT",
    provider: "OpenAI",
    headerBg: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)",
    accent: "#10a37f",
    bodyClass: "gift-access-page--chatgpt",
    externalLabel: "Open ChatGPT in your browser",
    externalUrl: "https://chat.openai.com",
  },
  canva: {
    productName: "Canva",
    provider: "Canva Pty Ltd",
    headerBg: "linear-gradient(135deg, #5b21b6 0%, #7c3aed 45%, #a78bfa 100%)",
    accent: "#fff",
    bodyClass: "gift-access-page--canva",
    externalLabel: "Open Canva in your browser",
    externalUrl: "https://www.canva.com",
  },
  turnitin: {
    productName: "Turnitin",
    provider: "Turnitin",
    headerBg: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)",
    accent: "#38bdf8",
    bodyClass: "gift-access-page--turnitin",
    externalLabel: "Open Turnitin in your browser",
    externalUrl: "https://www.turnitin.com",
  },
};

const GiftAccessPage = () => {
  const { productKey } = useParams();
  const [searchParams] = useSearchParams();
  const cfg = PRODUCT_UI[productKey];

  const daysRaw = searchParams.get("days");
  const days = Math.min(365, Math.max(1, parseInt(daysRaw || "1", 10) || 1));
  const giftId = searchParams.get("gift") || "";

  if (!cfg) {
    return (
      <div className="module2-page gift-access-page">
        <div className="gift-access-page__shell gift-access-page__shell--narrow">
          <p className="error">This access link is not valid.</p>
          <Link to="/credits" className="button">
            Back to Credit center
          </Link>
        </div>
      </div>
    );
  }

  const external = cfg.externalUrl;

  return (
    <div className={`module2-page gift-access-page ${cfg.bodyClass}`}>
      <header className="gift-access-page__topbar">
        <Link to="/credits" className="gift-access-page__back">
          ← Credit center
        </Link>
        <span className="gift-access-page__pill">
          Access hub · {days} day{days === 1 ? "" : "s"}
        </span>
      </header>

      <div className="gift-access-page__shell">
        <section
          className="gift-access-page__hero"
          style={{ background: cfg.headerBg, borderColor: cfg.accent }}
        >
          <p className="gift-access-page__provider">{cfg.provider}</p>
          <h1 className="gift-access-page__title">{cfg.productName}</h1>
          <p className="gift-access-page__lead">
            Your access is recorded for <strong>{days}</strong> day{days === 1 ? "" : "s"}. Open the official product
            below to continue in your browser.
          </p>
          {giftId ? (
            <p className="gift-access-page__meta">
              Reference: <code>{giftId}</code>
            </p>
          ) : null}
          <a
            className="gift-access-page__cta"
            href={external}
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundColor: productKey === "canva" ? "#fff" : cfg.accent, color: productKey === "canva" ? "#5b21b6" : "#fff" }}
          >
            {cfg.externalLabel} ↗
          </a>
        </section>
      </div>
    </div>
  );
};

export default GiftAccessPage;
