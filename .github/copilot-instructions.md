# Copilot Instructions for CSE471-Project

## Big picture
- This repo is a split frontend/backend app: `client/` (React + Vite) and `server/` (Express + MongoDB).
- Backend entrypoint is `server/app.js`; it mounts REST routes under `/api/*` and initializes Socket.IO via `initSocketServer`.
- Frontend entrypoint is `client/src/main.jsx`; all app routes live in `client/src/App.jsx`.

## Architecture patterns to follow
- Server layering is route -> controller -> model/service (see `server/routes/*.js`, `server/controllers/*.js`, `server/models/*.js`).
- Keep server modules in CommonJS (`require`, `module.exports`), not ESM.
- Keep client modules in ESM (`import`/`export`) and function components/hooks.
- Most JSON responses use `{ success, message?, data? }`; preserve this shape in new endpoints.
- Realtime signaling is centralized in `server/socket/socketServer.js` (`emitToUser`, room joins, call events).

## Auth and authorization conventions
- Client stores auth in `localStorage` (`token`, `user`) via `AuthContext` (`client/src/context/AuthContext.jsx`).
- Always call backend with `client/src/api/axios.js`; it injects `Authorization: Bearer <token>` automatically.
- 401 clears local auth and redirects to `/login`; 403 with `ACCOUNT_SUSPENDED`/`ACCOUNT_BANNED` does the same.
- Protected pages use `ProtectedRoute`; admin UI uses `AdminRoute` and `user.isDashboardAdmin`.
- Server `auth` middleware attaches `req.user` and enforces account status (`server/middleware/auth.js`).
- Dashboard admin checks are broader than role-only (`server/utils/adminAccess.js`): role, allowlisted email, or designated name match.

## Realtime and cross-component flows
- Use one shared client socket from `client/src/socket/chatSocket.js` (`connectChatSocket`, `disconnectChatSocket`).
- Socket auth token is passed in `auth: { token }`; do not create ad-hoc socket clients in feature code.
- Notifications/toasts are wired through `OfferNotifications` and `ReviewNotificationContext`.
- Session lifecycle (`server/controllers/sessionController.js`) holds credits on start, then refunds/transfers on end actions.
- Course promotion creation (`server/controllers/coursePromotionController.js`) writes inbox rows and emits `promotion:new` to active users.
- Wallet/admin income/review updates are pushed with events like `wallet:update`, `platform:income`, `review:received`.

## Payments and credits
- Credit store + bKash checkout live in `server/controllers/creditStoreController.js` and `server/services/bkashCheckoutService.js`.
- Support both real bKash and demo/local paths (`BKASH_DEMO_MODE`, simulate purchase flags); keep both behaviors intact when editing.
- Course purchases support both credits and bKash under `server/controllers/coursePromotionController.js`.

## Developer workflow
- Start backend: `cd server && npm install && npm run dev`
- Start frontend: `cd client && npm install && npm run dev`
- Build frontend: `cd client && npm run build`
- No dedicated test scripts are currently defined in `client/package.json` or `server/package.json`.
- Local defaults: frontend `http://localhost:5173`, backend `http://localhost:5000`.

## Deployment/config notes
- Vercel configs (`vercel.json` at root and `client/vercel.json`) are SPA rewrites to `index.html`.
- Frontend backend base URL comes from `VITE_API_URL` (fallback `http://localhost:5000`).
- Backend CORS/socket origins are controlled by `CLIENT_URL` (with localhost fallbacks in socket server).
