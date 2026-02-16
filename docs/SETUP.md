# Setup (Vercel + Supabase)

## 1) Supabase
- Create a Supabase project.
- Apply migrations in order:
  - `supabase/migrations/20260205173000_init.sql`
  - `supabase/migrations/20260205173100_seed_content.sql`
  - `supabase/migrations/20260206120000_engagement_redesign.sql`
  - `supabase/migrations/20260216123000_growth_and_diagnostics.sql`
  - `supabase/migrations/20260216150000_error_dashboard_rpc.sql`
- In Auth settings:
  - Enable **Email confirmations** (recommended)
  - Configure **Site URL** to your Vercel domain (for redirects)
  - Add redirect URLs:
    - `http://localhost:3000/auth/callback`
    - `https://<your-domain>/auth/callback`
  - Enable provider **Google** in `Authentication > Providers` and set:
    - Google OAuth client ID
    - Google OAuth client secret
    - Authorized redirect URI in Google Console:
      - `https://<your-project-ref>.supabase.co/auth/v1/callback`

### OAuth diagnostics endpoint
- Health check endpoint:
  - `GET /api/auth/oauth-health`
- Use it after deploy to verify callback URL and provider setup hints.

### Nutri allowlist (critical)
Insert allowed nutritionist emails into `public.nutri_invites` (SQL editor), e.g.:

```sql
insert into public.nutri_invites(email) values ('nutri@medibilbao.com');
```

Only users whose email is in `nutri_invites` will get role `nutri` on signup.

## 2) Storage
- Bucket: `meal-photos` (created by migration)
- Object name format: `<patient_id>/<log_id>.jpg`

## 3) Next.js (local)
- Copy `.env.example` to `.env.local` and fill:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - (optional) `GROQ_API_KEY`

Run:
```bash
npm run dev
```

## 5) New growth modules
- Onboarding fast-start API:
  - `GET/POST /api/onboarding/fast-start`
- Challenges + missions APIs:
  - `GET /api/challenges/feed`
  - `POST /api/challenges/create`
  - `POST /api/challenges/enroll`
  - `POST /api/challenges/complete-mission`
- Push subscriptions API:
  - `POST/DELETE /api/push/subscriptions`
- Error diagnostics API:
  - `POST /api/diagnostics/error`
  - `GET /api/diagnostics/dashboard?days=14` (nutri)

## 4) Vercel deploy
- Import the repo in Vercel
- Set the same env vars in Vercel project settings
