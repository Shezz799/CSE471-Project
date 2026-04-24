# Setup Guide

## Prerequisites
- Node.js 18+
- A MongoDB Atlas cluster (or other MongoDB URI)
- A Google Cloud project with OAuth 2.0 credentials (Web client)

## Environment files

| Location | Purpose |
|----------|---------|
| `server/.env` | Copy from `server/.env.example` — database, JWT, Google, **credits / bKash** |
| `client/.env.local` | Copy from `client/.env.example` — **`VITE_API_URL`**, **`VITE_GOOGLE_CLIENT_ID`** |

If the Credit center or login fails with network errors, **`VITE_API_URL` must point at your running API** (default `http://localhost:5000`).

## Install dependencies

### Server

```bash
cd server
npm install
```

### Client

```bash
cd client
npm install
```

## Run the apps

Run **both** in separate terminals.

### Server

```bash
cd server
npm run dev
```

### Client

```bash
cd client
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Credits & bKash (Module 3)

See **`MUKTADIR_FEATURE_GUIDE.md`** for API routes and behaviour.

Quick options:

1. **`BKASH_DEMO_MODE=true`** (server) — **Recommended for local demos**: full checkout-shaped flow without ngrok or calling bKash. Restart the server after changing `.env`.
2. **`ALLOW_CREDIT_PURCHASE_SIMULATE=true`** — one-click fake credits on the Credit center (dev only).
3. **Real bKash sandbox** — set `BKASH_*` credentials and **`BKASH_CALLBACK_ORIGIN`** to a **public HTTPS** URL (e.g. ngrok) pointing at this API; user returns to `GET /callback`.

## Notes

- Sign in with Google using an allowed email domain (see `server/controllers/userController.js` — e.g. `@gmail.com`, `@g.bracu.ac.bd`).
- If you change ports, update **`CLIENT_URL`** (server), **`VITE_API_URL`** (client), and Google OAuth **authorized JavaScript origins / redirect URIs**.
