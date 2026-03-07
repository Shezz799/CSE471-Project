# Baby steps: Muktadir commits Prithila's Module 1 (Users can create help request)

You do **not** need to delete any files. The project already has your (Muktadir's) work and the create-post flow. You only change **two things on your PC**: (1) Git identity in this repo, (2) one optional text in the app. Then you commit and push as **Muktadir**.

**All commands below use forward slashes** so they work in **Git Bash** (no `\`).

---

## Do NOT delete anything

- Keep all existing files (server, client, Dashboard, feed, Post model, etc.).
- Prithila's Module 1 feature ("Users can create help request") is already in the project: the Dashboard has "Create Post" → form (Subject, Topic, Description, Credits) → saves to DB → shows in feed. You are only making sure the **next commit** is under **your** (Muktadir's) GitHub.

---

## Where you make changes on your PC

1. **Git config** — only inside this repo (CSE471-Project). So future commits here use your name/email.
2. **Optional:** One line in `client/src/pages/Dashboard.jsx` — change "Create a post" to "Create a help request" so the feature is clearly labeled.
3. **GitHub:** Be logged in as **you** (e.g. RedRabies) when you push.

No other folders, no global Git config, no deleting files.

---

## Step 1: Open terminal and go to project root

In Git Bash (or PowerShell), run:

```bash
cd C:/CSE471-Project
```

Or in Git Bash:

```bash
cd /c/CSE471-Project
```

Check: your prompt should end with `CSE471-Project`. You must be in the **project root** (where you see `client`, `server`, `README.md`), not inside `client` or `server`.

---

## Step 2: Set this repo to Muktadir's identity

Run these two lines. Use **your** real name and **your** GitHub email (the one for RedRabies):

```bash
git config user.name "B. M. Muktadir Wafi"
git config user.email "your-github-email@example.com"
```

Replace `your-github-email@example.com` with the email you use for **your** GitHub account.

Check:

```bash
git config user.name
git config user.email
```

You should see your name and your email. From now on, commits in this repo will be under you until you change it again.

---

## Step 3: Get latest and create a branch for Prithila's module

Still in the project root (`C:/CSE471-Project`):

```bash
git checkout develop
git pull origin develop
git checkout -b feature/create-help-request
```

You are now on branch `feature/create-help-request`.

---

## Step 4 (optional): Label the feature as "Create help request"

The feature already works. If you want the UI to say "help request" clearly:

1. In VS Code/Cursor, open **client/src/pages/Dashboard.jsx**.
2. Find the text **"Create a post"** (in the modal title).
3. Change it to **"Create a help request"**.
4. Save the file.

If you skip this, you can still commit and push — the backend and form already implement "Users can create help request."

---

## Step 5: Commit

In the terminal, still in project root:

```bash
git add .
git status
git commit -m "feat: Users can create help request (Module 1 - Prithila)"
```

You should see "X files changed". The commit is now under **Muktadir** (your name/email).

---

## Step 6: Push as Muktadir

1. Make sure you are logged into **GitHub as you** (RedRabies) on this PC (browser or Git Credential Manager).
2. Push:

```bash
git push -u origin feature/create-help-request
```

If you get "Permission denied", GitHub is still using Prithila's account — sign in as your account and try again.

---

## Step 7: Open Pull Request on GitHub

1. Go to: **https://github.com/Shezz799/CSE471-Project**
2. Click **Compare & pull request** for `feature/create-help-request`.
3. Base branch: **develop**.
4. Click **Create pull request**. After merge, the commit will show under **Muktadir** (your account).

---

## Summary

| Question | Answer |
|----------|--------|
| Delete previous files? | **No.** Keep everything. |
| Where to change for Muktadir to commit? | (1) Git config in this repo only. (2) Optional: one title in Dashboard.jsx. (3) Be logged into GitHub as you when pushing. |
| Use `\` or `/` in paths? | Use **forward slashes** (`C:/CSE471-Project/server`) in Git Bash. |

All commands in this file use forward slashes so they work in Git Bash.
