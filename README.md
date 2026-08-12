# Cem SEO — Mobile App

A React Native (Expo) mobile app for Lumex Alliance's Cem SEO product, plus a small
Node.js/Express backend for auth and data.

## Structure

```
cem-seo-app/
  mobile/     Expo React Native app (iOS + Android)
  backend/    Express + Postgres API (auth, projects, audits, keywords)
```

## Running the backend

```bash
cd backend
npm install
npm run dev
```

The API starts on `http://localhost:4000`. It needs a real Postgres database —
see "Real hosted database (Postgres)" below for a free one from Neon. There's
no separate migration step; the backend creates its tables automatically on
first boot.

Default env vars (create a `.env` file in `backend/`, see `.env.example`):

```
PORT=4000
JWT_SECRET=change-this-to-something-random
```

## Running the mobile app

You're on Android, so two options — start with A, it's faster:

### Option A — Expo Go (fastest way to see it on your phone)

1. Install the **Expo Go** app from the Google Play Store on your Android phone.
2. On your computer:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
3. Scan the QR code shown in the terminal using the Expo Go app.
4. Update `mobile/src/api/client.ts` — change `localhost:4000` to your computer's
   LAN IP (e.g. `http://192.168.1.42:4000`) so your phone can reach the backend
   running on your computer. Find your IP with `ipconfig` (Windows) or
   `ifconfig` / `ip a` (Mac/Linux). Your phone and computer must be on the same
   Wi-Fi network.

This is great for development, but it needs Expo Go installed and your
computer running the dev server the whole time.

### Option B — Real installable APK (no Expo Go, no computer needed after install)

Once you're ready for something you can install like a normal app:

```bash
cd mobile
npm install -g eas-cli
eas login          # free Expo account
eas build --profile preview --platform android
```

This builds a real `.apk` in Expo's cloud (no Android Studio needed) and gives
you a download link. Install that `.apk` on your phone directly — it runs
standalone. The backend still needs to be reachable over the internet (see
below), since a standalone build can't reach your computer's `localhost`.

`app.json` and `eas.json` are already set up with the app icon, splash screen,
Android package name, and adaptive icon — ready to build as-is.

### Hosting the backend for Option B

For a standalone APK to work outside your home Wi-Fi, the backend needs a
public URL — [Render](https://render.com) or [Railway](https://railway.app)
both have free tiers and deploy a Node.js repo in a few clicks. Once deployed,
update `API_BASE_URL` in `mobile/src/api/client.ts` to that public URL and
rebuild the APK.

## Deploying the backend (so a real Android APK works away from home Wi-Fi)

`backend/render.yaml` is already set up for [Render](https://render.com):

1. Push this `backend/` folder to a GitHub repo (Render deploys from GitHub).
2. On Render: **New → Blueprint**, connect the repo, it reads `render.yaml`
   automatically and creates the service. `JWT_SECRET` is auto-generated for you.
3. Once deployed, Render gives you a URL like `https://cem-seo-backend.onrender.com`.
4. Put that URL into `mobile/src/api/client.ts` as `API_BASE_URL`, then run
   `eas build` again to bake it into the APK.
5. Add your `DATABASE_URL` (see below) as an environment variable in Render's dashboard too.

## Real hosted database (Postgres)

The backend now uses **real Postgres**, not SQLite — this means your data
survives redeploys and can handle real concurrent public users, unlike a
single SQLite file. [Neon](https://neon.tech) gives a genuinely free,
permanent Postgres database (unlike Render's free Postgres, which expires
after 30 days):

1. Go to **neon.tech**, sign up (free, no credit card required)
2. Create a new project — it generates a database instantly
3. Copy the **connection string** it shows you (starts with `postgresql://`)
4. Add it to `backend/.env`:
   ```
   DATABASE_URL=postgresql://your-connection-string-here
   ```
5. Restart the backend — on first boot it automatically creates all the
   tables it needs (`users`, `projects`, `audits`, `keywords`,
   `notification_prefs`) via `CREATE TABLE IF NOT EXISTS`, so there's no
   separate migration step to run.

⚠️ If you were previously running on SQLite, this is a fresh database —
existing local test accounts/projects won't carry over automatically. For
early-stage testing that's fine (just sign up again); a real migration
script would be a separate, contained piece of work if ever needed for
production data.

## Real SEO audit data (Google PageSpeed Insights)

The Website Audit screen now runs **real audits** — a live call to Google's
free PageSpeed Insights API (the same engine behind Lighthouse) against
whatever domain your project is tracking. It returns real performance,
accessibility, best-practices, and SEO scores, plus a list of actual issues
found on the site. This can take 10–30 seconds per audit since it's a live
analysis, not instant.

It works out of the box with no setup — Google allows a limited number of
free requests per day without a key. If you hit that limit, get a free API
key for a much higher quota:

1. Go to **console.cloud.google.com**, create a project (free)
2. Search **"PageSpeed Insights API"** in the API library, click **Enable**
3. Go to **Credentials → Create Credentials → API Key**
4. Copy the key into `backend/.env`:
   ```
   GOOGLE_PAGESPEED_API_KEY=your-key-here
   ```
5. Restart the backend

## What's implemented

- **Auth**: signup/login with JWT, plus real email verification (6-digit code)
- **Email verification**: new users must enter a code before reaching the main app. Without SMTP configured, the code prints to the backend's console (Termux/terminal) instead of emailing — see "Sending real emails" below to turn on actual delivery
- **Profile**: view email, edit display name
- **Notifications**: toggle email/push/weekly-report preferences, saved per-user
- **Help & Support**: FAQ plus a real "Email Support" button (opens your mail app)
- **Billing**: plan comparison UI (Starter/Growth/Agency) — upgrading isn't wired to real payments yet, see note below
- **Home Dashboard**: SEO score ring, stat cards, performance placeholder — pulls from `GET /api/dashboard`
- **Website Audit**: **real data** — health score, issue summary, top-issue list, and a **score trend chart** across your audit history, all from live Google PageSpeed Insights analysis (`POST /api/audit/run`, `GET /api/audit/history`)
- **Real alerts**: every new audit is compared to the previous one — if your score drops 10+ points or critical issues increase, you get a real email (respects the Notifications toggle)
- **Keyword Research**: search + keyword table (volume/difficulty numbers are still seeded, see note below), plus a **real Google Trends panel** — type any term and see genuine search-interest data and real rising/related searches, free, no API key needed
- **Projects**: real multi-site support — add unlimited real websites, switch which one is "active" (Home/Audit/Keywords follow whichever site is active), remove sites you no longer track
- **Navigation**: bottom tab bar (Home / Projects / Keywords / Audit / More) + auth stack + email verification gate
- **Google Search Console**: connect your real Google account (More → Google Search Console) to pull actual clicks/impressions/position into the Home dashboard, replacing sample numbers — free, works from your phone without hosting (see setup below)

## Google Search Console setup

This is free but needs a one-time Google Cloud setup (about 10 minutes):

1. Go to **console.cloud.google.com** — use the same project as PageSpeed if you already made one
2. **APIs & Services → Library** → search "Google Search Console API" → **Enable**
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - Fill in app name ("Cem SEO"), your email, etc.
   - Scopes: add `https://www.googleapis.com/auth/webmasters.readonly`
   - Under "Test users," add your own Google account email — this lets you use it immediately without waiting for Google's review
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: add `http://localhost:4000/api/gsc/callback`
5. Copy the **Client ID** and **Client Secret** it gives you
6. Add to `backend/.env`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=your-client-id
   GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:4000/api/gsc/callback
   ```
7. Restart the backend, then in the app go to **More → Google Search Console → Connect**

⚠️ **Important limitations, please read**:
- This only works from **your own phone** right now, because the redirect goes to `localhost:4000` — that only resolves correctly on the same device running the backend. Once the backend is hosted (see "Deploying the backend" above), this needs to point to the real public URL instead, and you'd update `GOOGLE_OAUTH_REDIRECT_URI` and the redirect URI in Google Cloud to match.
- While your OAuth consent screen is in **"Testing"** mode, only Google accounts you've explicitly added as test users (max 100) can connect — anyone else sees a warning screen and can't proceed. Before public users can use this, you'd need to submit the app for Google's verification review (this can take days to weeks for sensitive scopes like this one).
- You can only connect a Search Console property you already own and have verified in your own Google Search Console account — this feature can't create that verification for you.

## Sending real emails (verification codes)

By default, verification codes just print to the backend's console — fine for
testing, not fine for real users. To send actual emails, add SMTP credentials
to `backend/.env` (copy from `.env.example`). Easiest free option is Gmail:

1. Turn on 2-Step Verification on the Google account you want to send from
2. Go to **myaccount.google.com/apppasswords** and create an "app password"
3. In `backend/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=the-16-character-app-password
   SMTP_FROM="Cem SEO <your-email@gmail.com>"
   ```
4. Restart the backend — new signups will now get real emails.

## Billing / real payments

The Billing screen is UI-only right now — tapping "Upgrade" shows a
placeholder message instead of charging anyone. Real payments need a
processor account (Stripe is the standard choice) that only you can create,
since it involves your business/bank details. Once you have Stripe API keys,
wiring this up means: a `stripe` package on the backend, a checkout-session
endpoint, and a webhook to mark a user as upgraded — ask if you want this built.

## What's still a stub / next steps

- Billing isn't connected to real payments (see above)
- Password reset / "forgot password" flow doesn't exist yet
- Keyword data is still seeded/mocked in the database for volume/difficulty — real numbers need a paid provider (Ahrefs/SEMrush/Moz all require paid API access, no meaningful free tier exists for this). The Google Trends panel is real, free data, but Trends only shows relative interest, not exact search volume, and is a genuinely different (complementary) kind of data.
- Google Trends integration uses an unofficial data layer (Google has no public Trends API) — it can occasionally fail or get rate-limited under heavy use; the app is built to degrade gracefully (panel just doesn't show) rather than break anything else when that happens
- Dashboard's click/impression/position numbers are still seeded, not pulled from Google Search Console — that requires the site owner to connect their Google account and verify domain ownership (more setup than PageSpeed, doable as a next step)
- No push notifications actually sent yet (the toggle exists and saves, but nothing triggers a real push)
- No CI/CD
- Backend isn't deployed anywhere yet — needed for a standalone Android APK to work outside your home Wi-Fi (see "Hosting the backend" above)
