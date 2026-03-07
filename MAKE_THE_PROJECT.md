# Baby steps: make the project run

Do these in order.

**Important:** If you use **Git Bash**, always use **forward slashes** in paths (e.g. `C:/CSE471-Project/server` or `/c/CSE471-Project/server`). Do **not** use backslashes `\` — they break in Git Bash.

---

## Step 1: Open the project

1. Open **VS Code** or **Cursor**.
2. **File → Open Folder**.
3. Select the folder: **`C:\CSE471-Project`** (or wherever the project is).
4. Click **Select Folder**. You should see **client**, **server**, and files like **README.md** in the sidebar.

---

## Step 2: Install server dependencies

1. Open the terminal: **Terminal → New Terminal** (or press **Ctrl+`**).
2. Go to the server folder. Use **forward slashes** (works in Git Bash and PowerShell):

   ```bash
   cd C:/CSE471-Project/server
   ```

   Or in Git Bash you can use: `cd /c/CSE471-Project/server`

3. Install packages. Type and press **Enter**:

   ```bash
   npm install
   ```

4. Wait until it finishes (no red errors). You should see something like "added XXX packages".

---

## Step 3: Install client dependencies

1. Open a **second** terminal: click the **+** in the terminal panel, or **Terminal → New Terminal**.
2. Go to the client folder (use **forward slashes**):

   ```bash
   cd C:/CSE471-Project/client
   ```

3. Install packages:

   ```bash
   npm install
   ```

4. Wait until it finishes. You should see "added XXX packages".

---

## Step 4: Check environment files

The app needs **.env** files. You should have:

- **`server/.env`** — with at least `MONGO_URI`, `JWT_SECRET`, `PORT`, `GOOGLE_CLIENT_ID`, `CLIENT_URL`.
- **`client/.env`** — with `VITE_API_URL=http://localhost:5000` (or whatever port the server uses).

If you got these from a zip or from your team, copy them into **server** and **client** as described earlier. If they’re already there, skip this step.

---

## Step 5: Start the server

1. In the terminal where you ran **server** `npm install`, make sure you’re in the server folder:

   ```bash
   cd C:/CSE471-Project/server
   ```

2. Start the server:

   ```bash
   npm run dev
   ```

3. You should see something like:
   - `Starting server...`
   - `Server running on port 5000`
   - `MongoDB Connected: ...`

4. **Leave this terminal open.** Do not close it.

---

## Step 6: Start the client

1. In the **other** terminal (the one you used for **client** `npm install`), go to the client folder (use **forward slashes**):

   ```bash
   cd C:/CSE471-Project/client
   ```

2. Start the client:

   ```bash
   npm run dev
   ```

3. You should see something like:
   - `VITE v5.x.x  ready in XXX ms`
   - `Local:   http://localhost:5173/`

4. **Leave this terminal open too.**

---

## Step 7: Open the app in the browser

1. Open **Chrome** (or any browser).
2. In the address bar type: **http://localhost:5173**
3. Press **Enter**.
4. You should see the app (login/register page).
5. Log in (or register with a BRACU email if using Google OAuth).
6. After login you should see the **Skill Sharing Feed** dashboard (feed on the left, profile and options on the right).

---

## If something goes wrong

| Problem | What to do |
|--------|------------|
| **"npm is not recognized"** | Install Node.js from https://nodejs.org (LTS). Restart VS Code and try again. |
| **Server: "Cannot find module"** | In **server** folder run `npm install` again, then `npm run dev`. |
| **Client: "Cannot find module"** | In **client** folder run `npm install` again, then `npm run dev`. |
| **Server: "MongoDB connection" error** | Check **server/.env** has a correct `MONGO_URI` from MongoDB Atlas. |
| **Server: "Port 5000 in use"** | In **server/.env** add `PORT=5001`. Then in **client/.env** set `VITE_API_URL=http://localhost:5001`. Restart both server and client. |
| **Blank page or API errors** | Make sure **client/.env** has `VITE_API_URL=http://localhost:5000` (or the port your server uses). Restart the client after changing .env. |

---

## Summary

1. Open project folder in VS Code.
2. Terminal 1: `cd C:/CSE471-Project/server` → `npm install` → `npm run dev` (leave open).
3. Terminal 2: `cd C:/CSE471-Project/client` → `npm install` → `npm run dev` (leave open).
4. Browser: **http://localhost:5173** → log in → use the dashboard.

**Git Bash:** Always use `C:/CSE471-Project/server` or `/c/CSE471-Project/server` — never `C:\CSE471-Project\server`.

That’s it. You’ve made the project run.
