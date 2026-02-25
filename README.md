# Cedar Deal Dashboard

Ultra-lean deal tracker for Cedar Acquisitions with $0/month-friendly infra:
- Next.js App Router + Tailwind
- Supabase Free (Auth + Postgres + RLS)
- Vercel Free (hosting + daily cron)
- Resend Free (deadline email alerts)

## 1) Install and run

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 2) Environment variables

Set these in `.env.local` and in Vercel Project Settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL` (must be a verified sender/domain in Resend for production)
- `CRON_SECRET` (random secret; Vercel cron should send this as bearer token)
- `ADMIN_ALERT_EMAILS` (optional comma-separated fallback list)

## 3) Supabase setup

1. Open Supabase SQL Editor.
2. Run [`supabase/schema.sql`](./supabase/schema.sql).
3. Ensure Michael and Nico are marked `admin` in `public.user_roles`.
4. If your database was created from an older version of this repo, also run:
   [`supabase/migrations/20260224_assigned_rep_and_profiles.sql`](./supabase/migrations/20260224_assigned_rep_and_profiles.sql)
5. Then run:
   [`supabase/migrations/20260225_buyers_access_columns.sql`](./supabase/migrations/20260225_buyers_access_columns.sql)
6. Then run:
   [`supabase/migrations/20260225_buyers_toggle_rpc.sql`](./supabase/migrations/20260225_buyers_toggle_rpc.sql)
7. Then run:
   [`supabase/migrations/20260225_add_stacked_strategy.sql`](./supabase/migrations/20260225_add_stacked_strategy.sql)
8. Then run:
   [`supabase/migrations/20260225_stacked_dashboard.sql`](./supabase/migrations/20260225_stacked_dashboard.sql)

## 4) Cron setup (Vercel free)

`vercel.json` includes daily cron:
- `0 13 * * *` hitting `/api/cron/dd-alerts`

In Vercel, set `CRON_SECRET` and configure the cron request to include:

```txt
Authorization: Bearer <CRON_SECRET>
```

## 5) What is implemented

- Global sortable single-table dashboard (`/`)
- Dedicated stacked dashboard (`/stacked`) with a separate table
- Full-width compact table layout (no left-right scrolling on desktop)
- `DD Days Left` urgency badge (red at <= 48 hours)
- Add/Edit deal modal forms wired to Supabase
- Delete action wired to Supabase (admin only)
- Account-based `Assigned Rep` selector (`assigned_rep_user_id`)
- `buyers_found` as a global Yes toggle button (light/dark, clickable by any logged-in user)
- `access_type` field (`Lockbox`, `Appointment`, `Open`)
- Stacked board hand-entry fields:
  - Address, Acq Manager, Purchase Price, Net to Buyer, Assignment Fee, Cashflow
- Stacked board checklist toggles (PSA, Buyer, EMD, Lender, Appraisal, CTC) with one-click updates
- Supabase RLS for role-aware edit/delete logic (admin or creator/assigned-rep updates)
- DB trigger hardening to keep `created_by` immutable and restrict assignment changes to creator/admin
- Daily cron route that emails:
  - Assigned manager (`assigned_rep_user_id`) when `assignment_status = Assigned`
  - Admins when `assignment_status = Not Assigned`

## Notes

- Role enforcement is both UI-level and database-level (RLS is final authority).
- This remains intentionally minimal for speed and zero-cost operation.
