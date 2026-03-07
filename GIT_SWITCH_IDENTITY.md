# Switch Git identity (Muktadir vs Prithila) — baby steps

Your PC is currently using **Prithila's** Git (afnanjahanprithila). Use **per-repo** config in CSE471-Project so you can switch who the commits are attributed to.

---

## 1. Use YOUR identity (Muktadir) in this repo

When **you** are committing your own work in CSE471-Project:

1. Open terminal in **CSE471-Project** (e.g. `cd C:\CSE471-Project`).
2. Set **this repo only** (not the whole PC) to your name and email:

   ```bash
   git config user.name "Your Full Name"
   git config user.email "your-email@example.com"
   ```

   Replace with **your** name and the **email tied to your GitHub account** (e.g. RedRabies). Use the same email as on GitHub so commits link to your profile.

3. Check:

   ```bash
   git config user.name
   git config user.email
   ```

   You should see your name and email. These settings are **only for CSE471-Project**, not global.

---

## 2. Use PRITHILA's identity when doing her part

When you are implementing **Prithila's** feature ("Users can create help request") and you want commits to appear under **her** GitHub:

1. In the **same** repo (CSE471-Project), run:

   ```bash
   git config user.name "afnanjahanprithila"
   git config user.email "afnan.jahan.prithila@g.bracu.ac.bd"
   ```

2. Do her feature: create branch, edit code, commit, push. Those commits will show as **afnanjahanprithila** on GitHub.

3. When you're done with her part and want your next commits to be yours again, set back to your identity (Step 1).

---

## 3. Pushing: which GitHub account is used?

- **Commit author** (name/email) = what you set with `git config user.name` and `user.email` (Steps 1 and 2).
- **Who can push** = whichever account is logged in to GitHub on this PC (browser, Git Credential Manager, or GitHub CLI).

So:

- To **push as Muktadir (e.g. RedRabies):**  
  - Set repo to your name/email (Step 1).  
  - Make sure you’re logged into GitHub as **your** account (e.g. in browser, or `gh auth login` and choose your account).
- To **push as Prithila:**  
  - Set repo to Prithila’s name/email (Step 2).  
  - Make sure you’re logged into GitHub as **Prithila’s** account when you push.

If the wrong account is used for push, you’ll get permission denied. Switch the logged-in GitHub account (or use a different browser profile / `gh auth switch`) and try again.

---

## 4. Summary

| What you're doing              | In CSE471-Project run                    | Then commit & push        |
|--------------------------------|------------------------------------------|---------------------------|
| Your work (Muktadir)           | `git config user.name "Your Name"` etc. | Push with your GitHub     |
| Prithila's work (her feature) | `git config user.name "afnanjahanprithila"` etc. | Push with Prithila’s GitHub |

No need to change **global** config if you only switch in this repo.

---

## 5. Prithila's part: "Users can create help request" — baby steps

When you're doing **her** feature so commits show as **afnanjahanprithila**:

### Step A: Switch this repo to Prithila's identity

In CSE471-Project folder:

```bash
git config user.name "afnanjahanprithila"
git config user.email "afnan.jahan.prithila@g.bracu.ac.bd"
```

### Step B: Get latest and create her feature branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/create-help-request
```

### Step C: What’s already implemented

In this project, **“Users can create help request”** is already implemented:

- **Backend:** `POST /api/posts` — accepts subject, topic, description, creditsOffered and saves to the database (Post model).
- **Frontend:** Dashboard “Create Post” modal — form with Subject, Topic, Problem description, Credits offered; submits to the same API; new post appears in the Skill Sharing Feed.

So the **data flow** is already there: form → API → database → feed.

### Step D: What you can do for her assignment

1. **If the assignment only needs “users can create a help request”:**  
   You can leave the code as is. Before committing, set Git to Prithila (Step A), then add a short commit that documents or renames the modal (e.g. “feat: Users can create help request (Module 1 – Prithila)”) and push from her branch. That way the deliverable is clearly under her name.

2. **If the assignment wants a separate “Create Help Request” page:**  
   Add a new route (e.g. `/create-help-request`) and a page that shows the same form (Subject, Topic, Description, Credits), calls `POST /api/posts`, then redirects to the dashboard or feed. The backend and feed stay the same; you’re only adding another entry point for the same feature.

### Step E: Commit and push as Prithila

Make sure you’re logged into GitHub as **Prithila** (browser or `gh auth`), then:

```bash
git add .
git commit -m "feat: Users can create help request (Module 1)"
git push -u origin feature/create-help-request
```

Open a Pull Request into `develop` from `feature/create-help-request`. After merge, those commits will appear under **afnanjahanprithila**.
