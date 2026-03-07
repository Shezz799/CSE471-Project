# Push Prithila's part ("Users can create help request") under YOUR GitHub (Muktadir)

Follow these steps so the commits show as **your** account (e.g. RedRabies), not Prithila's.

---

## Step 1: Set this repo to YOUR identity

Open terminal in **CSE471-Project** and run (use **your** real name and **your** GitHub-linked email):

```bash
cd C:/CSE471-Project

git config user.name "B. M. Muktadir Wafi"
git config user.email "your-github-email@example.com"
```

(In Git Bash use `C:/CSE471-Project` or `/c/CSE471-Project` — not backslash `\`.)

Replace `your-github-email@example.com` with the email you use for **your** GitHub account (e.g. RedRabies). Check with:

```bash
git config user.name
git config user.email
```

---

## Step 2: Get latest and create a branch for her feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/create-help-request
```

---

## Step 3: (Optional) Make "Create Help Request" obvious in the UI

The feature already works (Dashboard → Create Post → Subject, Topic, Description, Credits → appears in feed). If you want one small change so it's clearly "help request":

- In `client/src/pages/Dashboard.jsx`, change the modal title from "Create a post" to "Create a help request" (or add a subtitle). Then save.

If you prefer no code change, skip this and go to Step 4.

---

## Step 4: Commit

```bash
git add .
git status
git commit -m "feat: Users can create help request (Module 1 - Prithila)"
```

---

## Step 5: Push using YOUR GitHub

1. Make sure you're logged into GitHub as **you** (RedRabies) on this PC (browser or Git Credential Manager).
2. Push the branch:

```bash
git push -u origin feature/create-help-request
```

If you get "Permission denied", the PC is still using Prithila's GitHub for push — sign out of her account / sign in as yours and try again.

---

## Step 6: Open Pull Request

- Go to: https://github.com/Shezz799/CSE471-Project
- Click **Compare & pull request** for `feature/create-help-request`
- Base: **develop**, then **Create pull request**
- After merge, the commit will appear under **your** GitHub (Muktadir/RedRabies).

Done. Prithila's part is in the repo; the commit is under your account.
