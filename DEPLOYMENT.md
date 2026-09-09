# DEPLOYMENT

Status: **NOT VERIFIED** — this document describes the deployment procedure.
Do not treat deployment as done until a production URL has been checked.

## 1. Prerequisites

- The repository pushed to `samsonjames7725-blip/LBMTGLk`
- Database migrated on the linked Supabase project (see DATABASE.md / SETUP.md)
- All secrets available (see ENVIRONMENT.md)

## 2. Vercel setup

1. Import the repository into Vercel (framework: Next.js — detected
   automatically; no build overrides needed).
2. Configure environment variables (Production + Preview):

   ```text
   NEXT_PUBLIC_APP_URL
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   SUPABASE_SECRET_KEY            # server-only
   NVIDIA_API_KEY / NVIDIA_MODEL  # or GEMINI_API_KEY (+ model overrides)
   CRON_SECRET
   ALLOWED_ENQUIRY_ORIGINS        # e.g. https://lifebridgemedtech.com
   SMTP_/IMAP_ credentials        # only when the delivery layer ships
   ```

   Only set values that actually exist. Never commit secrets to the repo.

3. Deploy. Cron schedules come from `vercel.json` (`crons`).

## 3. Supabase Auth production settings

After the Vercel URL is known (do not invent it beforehand), set in
Supabase Dashboard → Authentication → URL Configuration:

- Site URL: the production URL (e.g. `https://<app>.vercel.app` or the
  future custom domain)
- Redirect URLs: production URL, preview URLs as needed,
  `http://localhost:3000` for development

## 4. Cron

`vercel.json` registers five cron jobs (lead qualification, overdue
follow-ups, pipeline monitoring, daily report, customer reactivation). All
hit `/api/cron/<job>` with the `CRON_SECRET` bearer token and perform
internal actions only.

## 5. Custom domain (future)

A domain such as `ai.lifebridgemedtech.com` can be attached in Vercel →
Settings → Domains. DNS is managed by the owner — **never** changed
automatically, and the existing Hostinger website domain is not touched.

## 6. Post-deploy verification checklist

- [ ] `GET /health` returns `database: configured`
- [ ] Login works with a provisioned user; unprovisioned users rejected
- [ ] Leads list loads real data; website enquiry endpoint accepts a test
      payload from an allowed origin only
- [ ] AI command executes (or returns the honest stub marker when no key)
- [ ] Approvals approve/reject/execute behave; audit entries appear
- [ ] Cron endpoint rejects requests without the secret
