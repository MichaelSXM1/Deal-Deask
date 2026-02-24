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

## 4) Cron setup (Vercel free)

`vercel.json` includes daily cron:
- `0 13 * * *` hitting `/api/cron/dd-alerts`

In Vercel, set `CRON_SECRET` and configure the cron request to include:

```txt
Authorization: Bearer <CRON_SECRET>
```

## 5) What is implemented

- Global sortable single-table dashboard (`/`)
- `DD Days Left` urgency badge (red when <= 2 days)
- Add/Edit deal modal forms wired to Supabase
- Delete action wired to Supabase (admin only)
- Supabase RLS for role-aware edit/delete logic
- Daily cron route that emails:
  - Assigned manager (deal creator) when `assignment_status = Assigned`
  - Admins when `assignment_status = Not Assigned`

## Notes

- Role enforcement is both UI-level and database-level (RLS is final authority).
- This remains intentionally minimal for speed and zero-cost operation.
