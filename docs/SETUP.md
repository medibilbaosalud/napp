# Setup (Vercel + Supabase)

## 1) Supabase
- Create a Supabase project.
- Apply migrations in order:
  - `supabase/migrations/20260205173000_init.sql`
  - `supabase/migrations/20260205173100_seed_content.sql`
- In Auth settings:
  - Enable **Email confirmations** (recommended)
  - Configure **Site URL** to your Vercel domain (for redirects)

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

## 4) Vercel deploy
- Import the repo in Vercel
- Set the same env vars in Vercel project settings

