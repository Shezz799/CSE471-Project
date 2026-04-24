# Muktadir Feature Guide (Module 2 + Module 3)

This file tracks what was implemented so future chats can continue quickly.

**Setup:** copy `server/.env.example` → `server/.env`, `client/.env.example` → `client/.env.local`, then follow [INSTALL.md](./INSTALL.md).

## Implemented in this update

## 1) Module 3: Credit purchase and redemption of gifts

- Added backend credit store routes in `server/routes/creditStoreRoutes.js`
- Added backend controller in `server/controllers/creditStoreController.js`
- Added credit ledger model in `server/models/CreditLedger.js`
- Mounted new API namespace in `server/app.js`:
  - `GET /api/credits/store` -> wallet + packages + gifts + **payment flags** (bKash ready / simulate allowed)
  - `POST /api/credits/purchase/bkash/start` -> **real bKash** tokenized checkout: returns `bkashURL` (user opens in browser)
  - `GET /callback` -> **bKash return URL** (same host as `BKASH_CALLBACK_ORIGIN`): runs **Execute Payment**, then credits wallet + ledger once
  - `POST /api/credits/purchase` -> **dev-only simulated** instant credits (only if `ALLOW_CREDIT_PURCHASE_SIMULATE=true`)
  - `POST /api/credits/redeem` -> redeem a gift for credits
  - `GET /api/credits/ledger/me` -> recent purchase/redemption history
- bKash integration code:
  - `server/services/bkashCheckoutService.js` — grant token, create payment, execute payment (`fetch` to bKash)
  - `server/models/CreditPurchaseOrder.js` — pending order per checkout attempt
- Added frontend API client in `client/src/api/credits.js`
- Added frontend page in `client/src/pages/CreditsCenter.jsx`
- Added route `/credits` in `client/src/App.jsx`
- Added dashboard sidebar entry "Credits & gifts" in `client/src/pages/Dashboard.jsx`

## 2) Module 3: Admins can resolve user disputes

- Extended complaint model in `server/models/Complaint.js` with:
  - `resolvedBy`
  - `resolutionSummary`
  - `disputeOutcome`
- Extended complaint update flow in `server/controllers/complaintController.js`
- Added dedicated dispute resolution endpoint:
  - `POST /api/complaints/:id/resolve`
  - Sets status to resolved, pipeline to result, stores summary and outcome
  - Optional compensation credits to complainant wallet
  - Optional complainant email notification
  - Compensation entries are tracked in `CreditLedger` as `dispute_credit_adjustment`
- Added frontend API method `resolveComplaint` in `client/src/api/complaints.js`
- Added admin UI controls in `client/src/pages/admin/AdminComplaintDetail.jsx` for:
  - dispute outcome
  - resolution summary
  - compensation credits
  - finalize resolution

## 3) Module 2 improvement: Multi-topic mentor ratings

- Review model upgraded in `server/models/Review.js`:
  - Added `criteria` object with six topics:
    - topicKnowledge
    - teachingClarity
    - communication
    - patience
    - professionalism
    - helpfulness
- Review creation updated in `server/controllers/reviewController.js`:
  - Accepts `criteria`
  - Computes final `rating` as average of criteria
  - Backward-compatible fallback: if old client sends only rating, uses that for all criteria
- Review stats service updated in `server/services/reviewStats.js`:
  - Adds `topicAverages` for mentor profiles
  - Keeps overall average and distribution
- Rating form upgraded in `client/src/pages/RateMentor.jsx`:
  - six sub-rating topics
  - live computed final average
- Added display of sub-ratings in:
  - `client/src/components/ratings/ProfileRatingSection.jsx`
  - `client/src/pages/ReviewsAll.jsx`

## Notes for future continuation

### bKash (external API) — env vars (server `.env`)

Sandbox base URL (default in code if unset):  
`BKASH_TOKENIZE_BASE_URL=https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized`

Required for real checkout:

- `BKASH_APP_KEY` — from bKash onboarding / sandbox app
- `BKASH_APP_SECRET`
- `BKASH_USERNAME` — merchant username
- `BKASH_PASSWORD` — merchant password
- `BKASH_CALLBACK_ORIGIN` — **public HTTPS origin of this Node API only** (no path), e.g. `https://abc123.ngrok-free.app`  
  bKash redirects the payer to **`{origin}/callback?...`** after payment. Your server must expose `GET /callback` on that host (already wired in `server/app.js`).

Optional:

- `ALLOW_CREDIT_PURCHASE_SIMULATE=true` — enables `POST /api/credits/purchase` instant credits for **local dev only** (shown as “Simulate purchase” in the Credit center when the store payload allows it).

### Faculty / local demo without deploy (`BKASH_DEMO_MODE`)

Set **`BKASH_DEMO_MODE=true`** on the server (no bKash credentials or ngrok required).

Flow (mirrors production shape):

1. `POST /api/credits/purchase/bkash/start` creates a **`CreditPurchaseOrder`** with `isDemoCheckout: true` (same as real “after Create Payment”).
2. Browser opens **`/credits/bkash-demo?orderId=...`** (stands in for the real bKash payment URL).
3. `POST /api/credits/purchase/bkash/demo/complete` applies a **mock Execute Payment success** payload and runs the **same wallet + `CreditLedger` path** as the real `/callback` handler (`bkashDemo: true` in ledger metadata).

Turn **`BKASH_DEMO_MODE=false`** when testing real sandbox or going live (demo mode takes priority over live keys in `startBkashPurchase` when enabled).

Live production: switch `BKASH_TOKENIZE_BASE_URL` to the live tokenized base URL bKash gives you (see developer docs), keep the same flow.

### Other gateways (Nagad, Rocket, SSLCOMMERZ, etc.)

Add a sibling service (e.g. `server/services/nagadPaymentService.js`) and parallel routes such as `POST /api/credits/purchase/nagad/start`, reusing `CreditPurchaseOrder` with `provider: "nagad"` and a provider-specific callback route.

### Existing branches

Unrelated repo history was not reverted by this guide.
