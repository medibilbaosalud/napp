# Supabase (DB + RLS + Storage)

This folder contains SQL migrations for the MediBilbao Salud MVP.

## Apply migrations
- Create a Supabase project
- Copy SQL from `supabase/migrations/*` into the Supabase SQL editor (or use the CLI)
- Ensure Auth email verification is enabled (recommended)

## Buckets
- `meal-photos` (private): objects stored as `<patient_id>/<log_id>.jpg`

## Required env vars (Next.js)
See `.env.example`.

