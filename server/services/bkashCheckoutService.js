/**
 * bKash Tokenized Checkout (sandbox / live) — see https://developer.bka.sh/docs/tokenized-checkout-overview
 *
 * Env:
 * - BKASH_TOKENIZE_BASE_URL — e.g. https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized
 * - BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD
 * - BKASH_CALLBACK_ORIGIN — public origin bKash redirects to (must expose GET /callback)
 */

const DEFAULT_SANDBOX_BASE = "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized";

const getBaseUrl = () => (process.env.BKASH_TOKENIZE_BASE_URL || DEFAULT_SANDBOX_BASE).replace(/\/$/, "");

const isBkashConfigured = () =>
  Boolean(
    process.env.BKASH_APP_KEY &&
      process.env.BKASH_APP_SECRET &&
      process.env.BKASH_USERNAME &&
      process.env.BKASH_PASSWORD
  );

const parseEnvBool = (value) => {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
};

const isBkashDemoMode = () => parseEnvBool(process.env.BKASH_DEMO_MODE);

async function bkashJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`bKash returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  return { ok: res.ok, status: res.status, data };
}

async function grantToken() {
  const base = getBaseUrl();
  const { ok, data } = await bkashJson(`${base}/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: process.env.BKASH_USERNAME,
      password: process.env.BKASH_PASSWORD,
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET,
    }),
  });
  if (!ok || !data.id_token) {
    const msg = data.errorMessage || data.statusMessage || data.message || "Grant token failed";
    throw new Error(msg);
  }
  return data.id_token;
}

/**
 * @param {string} idToken
 * @param {{ amount: string, invoice: string, payerReference: string, callbackOrigin: string }} params
 */
async function createPayment(idToken, { amount, invoice, payerReference, callbackOrigin }) {
  const base = getBaseUrl();
  const origin = String(callbackOrigin || "").replace(/\/$/, "");
  if (!origin) {
    throw new Error("BKASH_CALLBACK_ORIGIN is required (public URL of this API, e.g. https://your-ngrok-url)");
  }

  const { ok, data } = await bkashJson(`${base}/checkout/payment/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: idToken,
      "x-app-key": process.env.BKASH_APP_KEY,
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: payerReference || " ",
      callbackURL: origin,
      amount: String(amount),
      currency: "BDT",
      intent: "authorization",
      merchantInvoiceNumber: invoice,
    }),
  });

  if (!ok || data.statusCode !== "0000") {
    const msg = data.errorMessage || data.statusMessage || JSON.stringify(data);
    throw new Error(msg);
  }
  return data;
}

/**
 * @param {string} idToken
 * @param {string} paymentID
 */
async function executePayment(idToken, paymentID) {
  const base = getBaseUrl();
  const { ok, data } = await bkashJson(`${base}/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: idToken,
      "x-app-key": process.env.BKASH_APP_KEY,
    },
    body: JSON.stringify({ paymentID }),
  });
  if (!ok) {
    const msg = data.errorMessage || data.statusMessage || JSON.stringify(data);
    throw new Error(msg);
  }
  return data;
}

module.exports = {
  isBkashConfigured,
  isBkashDemoMode,
  parseEnvBool,
  grantToken,
  createPayment,
  executePayment,
  getBaseUrl,
};
