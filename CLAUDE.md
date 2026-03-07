# Whozin

## Accounts & Auth

**MANDATORY on every session start (including resumed sessions):** Run these checks before doing ANY other work:

1. **GitHub** — Run `gh auth status` and confirm `TimLCooley` is the **active** account. If `TimLCooley-SGS` (work) is active instead, run `gh auth switch --user TimLCooley` immediately.
2. **Vercel** — Run `npx vercel switch tim-cooleys-projects-41557754` to ensure the correct team.

### GitHub
- **Account**: `TimLCooley` (personal) — NOT `TimLCooley-SGS` (work)
- **Repo**: TBD (will create when ready)
- If wrong account is active, run: `gh auth switch --user TimLCooley`

### Vercel
- **Account**: `tim-8478`
- **Team**: `tim-cooleys-projects-41557754`
- **Project**: `whozin`
- **Preview URL**: https://whozin-ruddy.vercel.app
- **Production URL**: https://whozin.io
- **Deploy command**: `npx vercel --prod`

### Supabase
- **Project ref**: `ooqdkonjcztjankkvejh`
- **API URL**: https://ooqdkonjcztjankkvejh.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/ooqdkonjcztjankkvejh
- The `SUPABASE_ACCESS_TOKEN` env var is set in `~/.bashrc`. If Supabase CLI commands fail with "Unauthorized", the token has expired — generate a new one at https://supabase.com/dashboard/account/tokens and update `~/.bashrc`.

## Integrations & Env Vars
All env vars go in `.env.local` (gitignored).

| Integration | Env Vars | Notes |
|-------------|----------|-------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | ref: `ooqdkonjcztjankkvejh` |
| **SendGrid** | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | For email notifications |
| **Twilio** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | For SMS/phone auth |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_PUBLISHABLE_KEY`, `STRIPE_LIVE_SECRET_KEY`, `STRIPE_LIVE_PUBLISHABLE_KEY` | For payments |

Other env vars: `NEXT_PUBLIC_SITE_URL`

## Key Patterns
- **Always `.trim()` env vars** when passing to SDK clients (Supabase, SendGrid, Twilio, Stripe). Vercel env vars can have trailing whitespace/newlines causing "Invalid character in header content" errors.
- **Always strip whitespace/code fences from LLM responses** before `JSON.parse()`. Claude often wraps JSON in markdown code fences or adds trailing text. Strip fences first, `.trim()`, then parse. Use balanced-brace extraction as a fallback — never a greedy `\{[\s\S]*\}` regex.
- **JS operator precedence bug**: `a || b ? c : d` evaluates as `(a || b) ? c : d`. Use `??` or parentheses.

## Architecture
- Next.js with App Router, TypeScript, Tailwind CSS
- Supabase for auth, database, and storage
- Phone-based auth (Twilio SMS OTP)
- Mobile-first PWA design

## Project Structure
```
src/
  app/
    page.tsx              # Landing page
    app/                  # Main app (auth-gated)
      layout.tsx
      page.tsx            # Home/dashboard
      groups/             # Groups feature
      activities/         # Activities
      settings/           # User settings
    auth/                 # Auth pages
      sign-in/
      sign-up/
      reset-password/
    admin/                # Admin panel (super_admin only)
    api/                  # API routes
  components/
    app/                  # App components
    landing/              # Landing page components
    admin/                # Admin components
    auth/                 # Auth components
    ui/                   # Shared UI components
  lib/
    supabase/             # Supabase client setup
    types.ts              # Database types
    queries.ts            # Data queries
    auth.ts               # Auth helpers
```

## Dev Server
- **Port**: 3001 (`npm run dev -- -p 3001`) — port 3000 is reserved for other projects

## Deploy
- `npx vercel --prod` to deploy
- Preview URL: https://whozin-ruddy.vercel.app
- Production URL: TBD (will point domain when ready)
