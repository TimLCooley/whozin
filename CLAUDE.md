# Whozin

## Accounts & Auth

**MANDATORY on every session start (including resumed sessions):** Run these checks before doing ANY other work:

1. **GitHub** — Run `gh auth status` and confirm `TimLCooley` is the **active** account. If `TimLCooley-SGS` (work) is active instead, run `gh auth switch --user TimLCooley` immediately.
2. **Vercel** — Run `npx vercel switch tim-cooleys-projects-41557754` to ensure the correct team.

### GitHub
- **Account**: `TimLCooley` (personal) — NOT `TimLCooley-SGS` (work)
- **Repo**: `TimLCooley/whozin`
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
- **Auth providers config**: https://supabase.com/dashboard/project/ooqdkonjcztjankkvejh/auth/providers
- The `SUPABASE_ACCESS_TOKEN` env var is set in `~/.bashrc`. If Supabase CLI commands fail with "Unauthorized", the token has expired — generate a new one at https://supabase.com/dashboard/account/tokens and update `~/.bashrc`.

## Platform Credentials & Identifiers

### Apple Developer
- **Team ID**: `3QM6SDB8NG`
- **Sign in with Apple Service ID**: `io.whozin.app.signin` (configured in Supabase)
- **Sign in with Apple Key ID**: `CBRF43DM33`
- **Sign in with Apple .p8 key**: `AuthKey_CBRF43DM33.p8`
- **Push Notifications Key ID**: `96S7QHD6MQ` (push only, NOT for Sign in with Apple)
- **App Store Bundle ID (iOS)**: `io.whozin.app`
- **Apple JWT client secret**: Generated from .p8 key, expires every 6 months — regenerate before September 2026
- **Portal**: https://developer.apple.com/account/
- **App Store Connect**: https://appstoreconnect.apple.com

### Google Play / Google Cloud
- **Google Play Account ID**: `6533159575073604082`
- **Google Play Package Name (Android)**: `io.whozin.app`
- **Google Play Console**: https://play.google.com/console/
- **Google Cloud Project**: `Whozin` (whozin-469312)
- **Google Cloud Console**: https://console.cloud.google.com
- **Google OAuth Client ID**: `85647149825-ppb9jgfq3umjv47s4rlbr4paj0ns4lbq.apps.googleusercontent.com`
- **Service Account (RevenueCat)**: `revenuecat@whozin-469312.iam.gserviceaccount.com`
- **Service Account (Deploy)**: `bubble-deploy-access@whozin-469312.iam.gserviceaccount.com`

### RevenueCat
- **Project ID**: `projb8bc4499`
- **Secret API Key**: `sk_zpgWfRuUzTrGadPnDvYCBsgMWEwjU`
- **Apple app credentials**: Valid (SubscriptionKey .p8 uploaded)
- **Google Play app credentials**: Pending (service account permission propagation, 24-48h)
- **Webhook URL**: `https://whozin.io/api/webhooks/revenuecat` (needs to be configured in RevenueCat dashboard)
- **Dashboard**: https://app.revenuecat.com

### Stripe
- **Webhook URL**: `https://whozin.io/api/webhooks/stripe`
- **Dashboard**: https://dashboard.stripe.com

### Capacitor (Native Apps)
- **App ID (Android & iOS)**: `io.whozin.app`
- **Config**: `capacitor.config.ts` — uses `io.whozin.app` as appId
- **Server URL**: `https://whozin.io` (remote URL pattern — WebView points to production)

### Subscription Products
- **Monthly**: `whozin_pro_monthly` — $12.99/mo (auto-renewable)
- **Annual**: `whozin_pro_annual` — $99.99/yr (auto-renewable)
- **Lifetime**: `whozin_pro_lifetime` — $199.99 (non-consumable)
- **RevenueCat Entitlement**: `pro`
- Created in App Store Connect, pending submission for review

## Integrations & Env Vars
All env vars go in `.env.local` (gitignored). Also set in Vercel project settings for production.

| Integration | Env Vars | Notes |
|-------------|----------|-------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | ref: `ooqdkonjcztjankkvejh` |
| **SendGrid** | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | For email notifications |
| **Twilio** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | For SMS/phone auth |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_PUBLISHABLE_KEY`, `STRIPE_LIVE_SECRET_KEY`, `STRIPE_LIVE_PUBLISHABLE_KEY` | Web payments |
| **RevenueCat** | `REVENUECAT_WEBHOOK_SECRET` | iOS/Android IAP webhook auth |
| **Google Cloud** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_AI_API_KEY` | Maps, Places, Gemini AI |
| **Apple** | `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Push notifications (APNs) |

Other env vars: `NEXT_PUBLIC_SITE_URL`

## Key Patterns
- **Always `.trim()` env vars** when passing to SDK clients (Supabase, SendGrid, Twilio, Stripe). Vercel env vars can have trailing whitespace/newlines causing "Invalid character in header content" errors.
- **Always strip whitespace/code fences from LLM responses** before `JSON.parse()`. Claude often wraps JSON in markdown code fences or adds trailing text. Strip fences first, `.trim()`, then parse. Use balanced-brace extraction as a fallback — never a greedy `\{[\s\S]*\}` regex.
- **JS operator precedence bug**: `a || b ? c : d` evaluates as `(a || b) ? c : d`. Use `??` or parentheses.
- **Dev account**: Phone `1111111111` (code `111111`) — auto-logs in without SMS, no super admin access.

## Architecture
- Next.js with App Router, TypeScript, Tailwind CSS
- Supabase for auth, database, and storage
- Phone-based auth (Twilio SMS OTP) + Google OAuth + Apple OAuth
- Capacitor for native iOS/Android (remote URL pattern)
- RevenueCat for iOS/Android payments, Stripe for web payments
- Both sync to `whozin_users.membership_tier` via webhooks
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
      callback/           # OAuth callback (Google/Apple)
    admin/                # Admin panel (super_admin only)
    api/
      auth/               # send-otp, verify-otp
      webhooks/           # revenuecat/, stripe/
      google/contacts/    # Google Contacts search
      groups/, activities/, friends/, user/, admin/
  components/
    app/                  # App components
    landing/              # Landing page components
    admin/                # Admin components
    auth/                 # Auth components (auth-form.tsx)
    ui/                   # Shared UI components
  lib/
    supabase/             # Supabase client setup
    capacitor.ts          # Platform detection (isNative, getPlatform)
    activity-presets.ts   # Activity presets + emoji suggestions
    types.ts              # Database types
    queries.ts            # Data queries
    auth.ts               # Auth helpers + super admin list
```

## Dev Server
- **Port**: 3001 (`npm run dev -- -p 3001`) — port 3000 is reserved for other projects

## Deploy
- `npx vercel --prod` to deploy
- Preview URL: https://whozin-ruddy.vercel.app
- Production URL: https://whozin.io
