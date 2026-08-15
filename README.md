# Teduh POS

A multi-tenant point-of-sale, analytics, and inventory app for supplier-based dessert cafes — any cafe can sign up and get their own private workspace. Built with Next.js (App Router), Tailwind CSS, and Supabase (Postgres + Auth, tenant isolation via Row Level Security).

## Features

- **Sell** — tap-to-order catalog, cart, Cash / QR Pay checkout
- **Giveaway** — free items for a customer, priced at full sell price so the till still balances (the owner "buys" it), tracked as its own payment method
- **History** — today's transactions, editable (adjust quantities/payment method) or voidable
- **Analytics** — revenue, orders, avg order, est. profit, revenue-by-day and busiest-hours charts, top items, category breakdown, payment split, items not selling — filterable by Today / 7 Days / 30 Days / All Time
- **Shelf Life** — expiry tracking per batch, color-coded by days remaining
- **Menu** — add/edit/remove items, price and (optional) cost per item

## One-time setup

### 1. Create a Supabase project (free tier)

1. Sign up at [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run the migration in `supabase/migrations/0001_init.sql`
3. In **Authentication → Providers**, email/password is enabled by default. For fastest local testing, you can disable "Confirm email" under **Authentication → Sign In / Providers → Email** — otherwise new signups need to click a confirmation email before their first login
4. Copy your **Project URL** and **anon public key** from **Settings → API**

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 3. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, sign up, and start using it.

### 4. Deploy (Vercel, free tier)

1. Push this repo to GitHub
2. Import it at [vercel.com/new](https://vercel.com/new)
3. Add the same two environment variables in the Vercel project settings
4. Deploy — Vercel auto-deploys on every push to `main` from then on

## Notes

- Every business's data is isolated by Postgres Row Level Security (see the migration) — verified by signing up as two different businesses locally and confirming neither can see the other's menu or sales.
- No billing is wired up — every signed-up business gets full access for free.
- This is a fresh app with no data migration from the original single-file `teduh-pos.html` version — new signups start with an empty menu.
