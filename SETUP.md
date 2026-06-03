# Property360 — Setup Guide

## 1. Supabase Project Setup

1. Go to https://supabase.com → New Project
2. Copy your **Project URL** and **Anon Key** from Project Settings → API
3. Update `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   ```

## 2. Database Setup

In Supabase → SQL Editor, run these files in order:

1. `supabase/migrations/001_schema.sql` — creates all tables, RLS policies, triggers
2. After creating your account, run `supabase/migrations/002_seed.sql` — adds sample data

## 3. Create Your Account

1. Run `npm run dev`
2. Open http://localhost:3000
3. Click **"Create Account"** with your email and password
4. Confirm your email (check Supabase Auth settings to disable email confirmation in development)

## 4. Run Seed Data

After creating your account, go to Supabase SQL Editor and run `002_seed.sql`.

## 5. Local Development

```bash
npm run dev
```

## 6. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Or connect your GitHub repo to Vercel and set env vars in the Vercel dashboard.

## Modules

| Route | Module |
|-------|--------|
| `/dashboard` | Summary cards, charts |
| `/properties` | Property assets |
| `/markets` | Market management |
| `/shops` | Shop management |
| `/tenants` | Tenant management |
| `/agreements` | Rental agreements + deposit calc |
| `/rent` | Monthly rent collection |
| `/deposits` | Deposit deduction tracking |
| `/apartments` | Apartment rentals |
| `/vehicles` | Vehicle fleet |
| `/expenses` | Expense tracking |
| `/staff` | Staff + salary |
| `/reports` | PDF/Excel reports |
| `/analytics` | Charts + comparisons |
| `/insights` | Smart business suggestions |
| `/notifications` | Alerts + reminders |

## Currency

The app uses ৳ (Bangladeshi Taka) by default. To change, edit `src/lib/utils/format.ts`.
