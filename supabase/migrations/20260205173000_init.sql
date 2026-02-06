-- MediBilbao Salud MVP schema (Supabase)
-- Date: 2026-02-05

create extension if not exists citext;
create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('patient', 'nutri');
  end if;
  if not exists (select 1 from pg_type where typname = 'log_type') then
    create type public.log_type as enum ('checkin', 'photo', 'detail');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_difficulty') then
    create type public.review_difficulty as enum ('good', 'normal', 'hard');
  end if;
  if not exists (select 1 from pg_type where typname = 'link_request_status') then
    create type public.link_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- Core tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique not null,
  role public.user_role not null,
  full_name text null,
  locale text not null default 'es' check (locale in ('es','eu')),
  created_at timestamptz not null default now()
);

create table if not exists public.nutri_invites (
  email citext primary key,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id)
);

create table if not exists public.patients (
  id uuid primary key references public.profiles(id) on delete cascade,
  goal text null,
  preferences jsonb not null default '{}'::jsonb,
  tracking_level text not null default 'simple' check (tracking_level in ('simple','photo','detail')),
  digestive_enabled boolean not null default false,
  onboarding_completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.patient_consents (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  consent_version text not null,
  accepted_at timestamptz not null,
  disclaimer_seen_at timestamptz not null
);

create table if not exists public.nutris (
  id uuid primary key references public.profiles(id) on delete cascade,
  clinic_display_name text not null default 'MediBilbao Salud',
  created_at timestamptz not null default now()
);

create table if not exists public.patient_link_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  nutri_email citext not null,
  patient_display_name text null,
  patient_email citext null,
  patient_note text null,
  status public.link_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by uuid null references public.profiles(id)
);

create unique index if not exists patient_link_requests_one_pending
  on public.patient_link_requests(patient_id)
  where status = 'pending';

create index if not exists patient_link_requests_by_nutri_email
  on public.patient_link_requests(nutri_email, created_at desc);

create table if not exists public.care_teams (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  nutri_id uuid not null references public.nutris(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  nutri_id uuid not null references public.nutris(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (patient_id, nutri_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  attachments jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_created
  on public.messages(thread_id, created_at);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  week_start date not null,
  plan_data jsonb not null,
  created_by uuid not null references public.nutris(id),
  updated_by uuid not null references public.nutris(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, week_start)
);

create index if not exists plans_patient_week
  on public.plans(patient_id, week_start desc);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  week_start date not null,
  plan_id uuid null references public.plans(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, week_start)
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null,
  category text null,
  quantity text null,
  is_checked boolean not null default false,
  source text not null default 'generated' check (source in ('generated','manual')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists shopping_items_list_order
  on public.shopping_list_items(shopping_list_id, sort_order, created_at);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  logged_at timestamptz not null default now(),
  type public.log_type not null,
  meal_slot text null,
  adherence text null check (adherence is null or adherence in ('cumpli','a_medias','no')),
  reason_codes text[] null,
  energy smallint null check (energy is null or (energy between 1 and 5)),
  hunger smallint null check (hunger is null or (hunger between 1 and 5)),
  notes text null,
  photo_object_name text null,
  data jsonb null,
  created_at timestamptz not null default now()
);

alter table public.logs
  add constraint logs_photo_object_name_shape
  check (
    photo_object_name is null
    or (
      split_part(photo_object_name, '/', 1) = patient_id::text
      and split_part(photo_object_name, '/', 2) = (id::text || '.jpg')
    )
  );

create index if not exists logs_patient_logged_at
  on public.logs(patient_id, logged_at desc);

create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  logged_on date not null,
  bloating smallint not null default 0 check (bloating between 0 and 3),
  reflux smallint not null default 0 check (reflux between 0 and 3),
  bowel text not null default 'none' check (bowel in ('none','hard','normal','loose')),
  stress smallint not null default 0 check (stress between 0 and 3),
  created_at timestamptz not null default now(),
  unique (patient_id, logged_on)
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  week_start date not null,
  difficulty public.review_difficulty not null,
  obstacles jsonb not null default '[]'::jsonb,
  win text not null default '',
  adjust text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  nutri_response jsonb null,
  responded_at timestamptz null,
  responded_by uuid null references public.nutris(id),
  unique (patient_id, week_start)
);

create table if not exists public.content_lessons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_es text not null,
  body_es text not null,
  title_eu text not null,
  body_eu text not null,
  duration_sec int not null default 75,
  tags text[] not null default '{}'::text[],
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid null references public.profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Optional (MVP+): AI usage
create table if not exists public.ai_usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

create table if not exists public.ai_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  model text not null,
  allowed boolean not null,
  reason text null,
  created_at timestamptz not null default now()
);

-- Updated_at helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists set_shopping_lists_updated_at on public.shopping_lists;
create trigger set_shopping_lists_updated_at
before update on public.shopping_lists
for each row execute function public.set_updated_at();

-- Auth sync triggers (do not rely on JWT email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email citext;
  v_role public.user_role;
begin
  v_email := lower(new.email)::citext;

  if exists (select 1 from public.nutri_invites ni where ni.email = v_email) then
    v_role := 'nutri';
  else
    v_role := 'patient';
  end if;

  insert into public.profiles(id, email, role)
  values (new.id, v_email, v_role)
  on conflict (id) do update set email = excluded.email;

  if v_role = 'patient' then
    insert into public.patients(id) values (new.id) on conflict do nothing;
  else
    insert into public.nutris(id) values (new.id) on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set email = lower(new.email)::citext
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (new.email is distinct from old.email)
execute procedure public.handle_user_email_update();

-- RLS
alter table public.profiles enable row level security;
alter table public.nutri_invites enable row level security;
alter table public.patients enable row level security;
alter table public.patient_consents enable row level security;
alter table public.nutris enable row level security;
alter table public.patient_link_requests enable row level security;
alter table public.care_teams enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.plans enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.logs enable row level security;
alter table public.symptoms enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.content_lessons enable row level security;
alter table public.audit_events enable row level security;
alter table public.ai_usage_daily enable row level security;
alter table public.ai_audit_events enable row level security;

-- Grants & column safety (immutable role/email via privileges)
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, locale) on public.profiles to authenticated;
revoke update (email, role) on public.profiles from authenticated;

-- profiles: self; nutri can read assigned patients
drop policy if exists profiles_select_self_or_assigned on public.profiles;
create policy profiles_select_self_or_assigned
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.nutri_id = auth.uid()
        and ct.patient_id = public.profiles.id
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- nutri_invites: no access from clients (used by SECURITY DEFINER trigger)
revoke all on public.nutri_invites from anon, authenticated;

-- patients: self + assigned nutri read
revoke all on public.patients from anon, authenticated;
grant select, update on public.patients to authenticated;

drop policy if exists patients_select_self_or_assigned on public.patients;
create policy patients_select_self_or_assigned
  on public.patients for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.patients.id
        and ct.nutri_id = auth.uid()
    )
  );

drop policy if exists patients_update_self on public.patients;
create policy patients_update_self
  on public.patients for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- patient_consents: patient only
revoke all on public.patient_consents from anon, authenticated;
grant select, insert, update on public.patient_consents to authenticated;

drop policy if exists patient_consents_self on public.patient_consents;
create policy patient_consents_self
  on public.patient_consents for all
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- nutris: self only (basic)
revoke all on public.nutris from anon, authenticated;
grant select on public.nutris to authenticated;

drop policy if exists nutris_select_self on public.nutris;
create policy nutris_select_self
  on public.nutris for select
  to authenticated
  using (id = auth.uid());

-- patient_link_requests: patient insert/select; nutri select by email; updates via RPC (no update privilege)
revoke all on public.patient_link_requests from anon, authenticated;
grant select, insert on public.patient_link_requests to authenticated;

drop policy if exists plr_patient_select on public.patient_link_requests;
create policy plr_patient_select
  on public.patient_link_requests for select
  to authenticated
  using (patient_id = auth.uid());

drop policy if exists plr_patient_insert on public.patient_link_requests;
create policy plr_patient_insert
  on public.patient_link_requests for insert
  to authenticated
  with check (patient_id = auth.uid() and status = 'pending');

drop policy if exists plr_nutri_select_by_email on public.patient_link_requests;
create policy plr_nutri_select_by_email
  on public.patient_link_requests for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'nutri')
    and nutri_email = (select p.email from public.profiles p where p.id = auth.uid())
  );

-- care_teams: read for participants only; writes via RPC
revoke all on public.care_teams from anon, authenticated;
grant select on public.care_teams to authenticated;

drop policy if exists care_teams_select_participants on public.care_teams;
create policy care_teams_select_participants
  on public.care_teams for select
  to authenticated
  using (patient_id = auth.uid() or nutri_id = auth.uid());

-- threads: read for participants only; writes via RPC
revoke all on public.threads from anon, authenticated;
grant select on public.threads to authenticated;

drop policy if exists threads_select_participants on public.threads;
create policy threads_select_participants
  on public.threads for select
  to authenticated
  using (patient_id = auth.uid() or nutri_id = auth.uid());

-- messages: participants can read + insert; no update/delete
revoke all on public.messages from anon, authenticated;
grant select, insert on public.messages to authenticated;

drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.threads t
      where t.id = public.messages.thread_id
        and (t.patient_id = auth.uid() or t.nutri_id = auth.uid())
    )
  );

drop policy if exists messages_insert_participants on public.messages;
create policy messages_insert_participants
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.threads t
      where t.id = public.messages.thread_id
        and (t.patient_id = auth.uid() or t.nutri_id = auth.uid())
    )
  );

-- plans: patient read; assigned nutri CRUD
revoke all on public.plans from anon, authenticated;
grant select, insert, update, delete on public.plans to authenticated;

drop policy if exists plans_select_participants on public.plans;
create policy plans_select_participants
  on public.plans for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.plans.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

drop policy if exists plans_mutate_assigned_nutri on public.plans;
create policy plans_mutate_assigned_nutri
  on public.plans for all
  to authenticated
  using (
    exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.plans.patient_id
        and ct.nutri_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.plans.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

-- shopping: patient CRUD; assigned nutri read
revoke all on public.shopping_lists from anon, authenticated;
revoke all on public.shopping_list_items from anon, authenticated;
grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert, update, delete on public.shopping_list_items to authenticated;

drop policy if exists shopping_lists_select_participants on public.shopping_lists;
create policy shopping_lists_select_participants
  on public.shopping_lists for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.shopping_lists.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

drop policy if exists shopping_lists_mutate_patient on public.shopping_lists;
create policy shopping_lists_mutate_patient
  on public.shopping_lists for all
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

drop policy if exists shopping_items_select_participants on public.shopping_list_items;
create policy shopping_items_select_participants
  on public.shopping_list_items for select
  to authenticated
  using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = public.shopping_list_items.shopping_list_id
        and (
          sl.patient_id = auth.uid()
          or exists (select 1 from public.care_teams ct where ct.patient_id = sl.patient_id and ct.nutri_id = auth.uid())
        )
    )
  );

drop policy if exists shopping_items_mutate_patient on public.shopping_list_items;
create policy shopping_items_mutate_patient
  on public.shopping_list_items for all
  to authenticated
  using (
    exists (select 1 from public.shopping_lists sl where sl.id = public.shopping_list_items.shopping_list_id and sl.patient_id = auth.uid())
  )
  with check (
    exists (select 1 from public.shopping_lists sl where sl.id = public.shopping_list_items.shopping_list_id and sl.patient_id = auth.uid())
  );

-- logs: patient CRUD; assigned nutri read
revoke all on public.logs from anon, authenticated;
grant select, insert, update, delete on public.logs to authenticated;

drop policy if exists logs_select_participants on public.logs;
create policy logs_select_participants
  on public.logs for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.logs.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

drop policy if exists logs_mutate_patient on public.logs;
create policy logs_mutate_patient
  on public.logs for all
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- symptoms: patient CRUD; assigned nutri read
revoke all on public.symptoms from anon, authenticated;
grant select, insert, update, delete on public.symptoms to authenticated;

drop policy if exists symptoms_select_participants on public.symptoms;
create policy symptoms_select_participants
  on public.symptoms for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.symptoms.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

drop policy if exists symptoms_mutate_patient on public.symptoms;
create policy symptoms_mutate_patient
  on public.symptoms for all
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- weekly_reviews: select participants only; write via RPC
revoke all on public.weekly_reviews from anon, authenticated;
grant select on public.weekly_reviews to authenticated;

drop policy if exists weekly_reviews_select_participants on public.weekly_reviews;
create policy weekly_reviews_select_participants
  on public.weekly_reviews for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.weekly_reviews.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

-- content_lessons: read for all authenticated
revoke all on public.content_lessons from anon, authenticated;
grant select on public.content_lessons to authenticated;

drop policy if exists content_lessons_select_published on public.content_lessons;
create policy content_lessons_select_published
  on public.content_lessons for select
  to authenticated
  using (published = true);

-- audit: via RPC/server only
revoke all on public.audit_events from anon, authenticated;

-- AI: via RPC/server only
revoke all on public.ai_usage_daily from anon, authenticated;
revoke all on public.ai_audit_events from anon, authenticated;

-- RPC: link requests
create or replace function public.request_link(
  p_nutri_email text,
  p_patient_display_name text default null,
  p_patient_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_email citext;
  v_nutri_email citext;
  v_request_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select role, email into v_role, v_email from public.profiles where id = v_user_id;
  if v_role is distinct from 'patient' then
    raise exception 'only_patient';
  end if;

  v_nutri_email := lower(p_nutri_email)::citext;
  if not exists (select 1 from public.nutri_invites ni where ni.email = v_nutri_email) then
    raise exception 'nutri_not_allowed';
  end if;

  update public.patient_link_requests
    set status = 'rejected', resolved_at = now(), resolved_by = v_user_id
  where patient_id = v_user_id and status = 'pending';

  insert into public.patient_link_requests(
    patient_id, nutri_email, patient_display_name, patient_email, patient_note, status
  ) values (
    v_user_id,
    v_nutri_email,
    nullif(trim(p_patient_display_name), ''),
    v_email,
    nullif(trim(p_patient_note), ''),
    'pending'
  ) returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.accept_link_request(p_request_id uuid)
returns table (patient_id uuid, nutri_id uuid, thread_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_email citext;
  v_req public.patient_link_requests%rowtype;
  v_thread_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select role, email into v_role, v_email from public.profiles where id = v_user_id;
  if v_role is distinct from 'nutri' then raise exception 'only_nutri'; end if;

  select * into v_req
  from public.patient_link_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'request_not_found'; end if;
  if v_req.status is distinct from 'pending' then raise exception 'request_not_pending'; end if;
  if v_req.nutri_email is distinct from v_email then raise exception 'not_your_request'; end if;

  if exists (select 1 from public.care_teams ct where ct.patient_id = v_req.patient_id) then
    raise exception 'patient_already_linked';
  end if;

  update public.patient_link_requests
    set status='approved', resolved_at=now(), resolved_by=v_user_id
  where id = p_request_id;

  insert into public.care_teams(patient_id, nutri_id)
  values (v_req.patient_id, v_user_id);

  insert into public.threads(patient_id, nutri_id)
  values (v_req.patient_id, v_user_id)
  on conflict (patient_id, nutri_id) do update set created_at = public.threads.created_at
  returning id into v_thread_id;

  patient_id := v_req.patient_id;
  nutri_id := v_user_id;
  thread_id := v_thread_id;
  return next;
end;
$$;

create or replace function public.reject_link_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_email citext;
  v_req public.patient_link_requests%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select role, email into v_role, v_email from public.profiles where id = v_user_id;
  if v_role is distinct from 'nutri' then raise exception 'only_nutri'; end if;

  select * into v_req
  from public.patient_link_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'request_not_found'; end if;
  if v_req.status is distinct from 'pending' then raise exception 'request_not_pending'; end if;
  if v_req.nutri_email is distinct from v_email then raise exception 'not_your_request'; end if;

  update public.patient_link_requests
    set status='rejected', resolved_at=now(), resolved_by=v_user_id
  where id = p_request_id;
end;
$$;

create or replace function public.cancel_link_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_req public.patient_link_requests%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select * into v_req
  from public.patient_link_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'request_not_found'; end if;
  if v_req.patient_id is distinct from v_user_id then raise exception 'not_your_request'; end if;
  if v_req.status is distinct from 'pending' then raise exception 'request_not_pending'; end if;

  update public.patient_link_requests
    set status='rejected', resolved_at=now(), resolved_by=v_user_id
  where id = p_request_id;
end;
$$;

-- Weekly review submit/response (metrics server-side)
create or replace function public.submit_weekly_review(
  p_week_start date,
  p_difficulty public.review_difficulty,
  p_obstacles jsonb,
  p_win text,
  p_adjust text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_week_start date;
  v_week_end timestamptz;
  v_adherence_pct numeric;
  v_checkins_count int;
  v_symptoms jsonb;
  v_insights jsonb;
  v_metrics jsonb;
  v_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'patient' then raise exception 'only_patient'; end if;

  v_week_start := date_trunc('week', p_week_start::timestamptz)::date;
  v_week_end := (v_week_start + 7)::timestamptz;

  select
    coalesce(avg(
      case adherence
        when 'cumpli' then 1
        when 'a_medias' then 0.5
        when 'no' then 0
        else null
      end
    ), 0) * 100,
    count(*)
  into v_adherence_pct, v_checkins_count
  from public.logs
  where patient_id = v_user_id
    and type = 'checkin'
    and logged_at >= v_week_start::timestamptz
    and logged_at < v_week_end;

  select jsonb_build_object(
    'bloating_avg', coalesce(avg(bloating)::numeric, 0),
    'reflux_avg', coalesce(avg(reflux)::numeric, 0),
    'stress_avg', coalesce(avg(stress)::numeric, 0)
  )
  into v_symptoms
  from public.symptoms
  where patient_id = v_user_id
    and logged_on >= v_week_start
    and logged_on < (v_week_start + 7);

  v_insights := jsonb_build_array(
    jsonb_build_object('text', format('Check-ins registrados: %s', v_checkins_count)),
    jsonb_build_object('text', format('Adherencia aproximada: %s%%', round(v_adherence_pct)::int))
  );

  v_metrics := jsonb_build_object(
    'week_start', v_week_start,
    'adherence_pct', round(v_adherence_pct)::int,
    'checkins_count', v_checkins_count,
    'symptoms', v_symptoms,
    'insights', v_insights
  );

  insert into public.weekly_reviews(patient_id, week_start, difficulty, obstacles, win, adjust, metrics, submitted_at)
  values (v_user_id, v_week_start, p_difficulty, coalesce(p_obstacles, '[]'::jsonb), coalesce(p_win,''), coalesce(p_adjust,''), v_metrics, now())
  on conflict (patient_id, week_start) do update
    set difficulty = excluded.difficulty,
        obstacles = excluded.obstacles,
        win = excluded.win,
        adjust = excluded.adjust,
        metrics = excluded.metrics,
        submitted_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.respond_weekly_review(
  p_review_id uuid,
  p_response jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_review public.weekly_reviews%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'nutri' then raise exception 'only_nutri'; end if;

  select * into v_review from public.weekly_reviews where id = p_review_id for update;
  if not found then raise exception 'review_not_found'; end if;

  if not exists (select 1 from public.care_teams ct where ct.patient_id = v_review.patient_id and ct.nutri_id = v_user_id) then
    raise exception 'not_assigned';
  end if;

  update public.weekly_reviews
    set nutri_response = p_response,
        responded_at = now(),
        responded_by = v_user_id
  where id = p_review_id;
end;
$$;

-- AI: atomic per-user daily rate limit
create or replace function public.ai_check_and_increment(p_max int)
returns table (allowed boolean, new_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_day date;
  v_current int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  v_day := current_date;

  select count into v_current
  from public.ai_usage_daily
  where user_id = v_user_id and day = v_day
  for update;

  if not found then
    v_current := 0;
    insert into public.ai_usage_daily(user_id, day, count) values (v_user_id, v_day, 0);
  end if;

  if v_current >= p_max then
    allowed := false;
    new_count := v_current;
    return next;
    return;
  end if;

  update public.ai_usage_daily
    set count = count + 1
  where user_id = v_user_id and day = v_day
  returning count into v_current;

  allowed := true;
  new_count := v_current;
  return next;
end;
$$;

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when others then
    null;
  end;
end $$;

-- Storage: bucket + policies for meal photos
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists "meal_photos_insert_patient" on storage.objects;
create policy "meal_photos_insert_patient"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meal-photos'
    and split_part(name, '/', 1)::uuid = auth.uid()
  );

drop policy if exists "meal_photos_select_patient_or_assigned_nutri" on storage.objects;
create policy "meal_photos_select_patient_or_assigned_nutri"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (
      split_part(name, '/', 1)::uuid = auth.uid()
      or exists (
        select 1 from public.care_teams ct
        where ct.patient_id = split_part(name, '/', 1)::uuid
          and ct.nutri_id = auth.uid()
      )
    )
  );

drop policy if exists "meal_photos_delete_patient" on storage.objects;
create policy "meal_photos_delete_patient"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and split_part(name, '/', 1)::uuid = auth.uid()
  );

-- RPC execute permissions (defense-in-depth)
revoke execute on function public.request_link(text, text, text) from public;
revoke execute on function public.accept_link_request(uuid) from public;
revoke execute on function public.reject_link_request(uuid) from public;
revoke execute on function public.cancel_link_request(uuid) from public;
revoke execute on function public.submit_weekly_review(date, public.review_difficulty, jsonb, text, text) from public;
revoke execute on function public.respond_weekly_review(uuid, jsonb) from public;
revoke execute on function public.ai_check_and_increment(int) from public;

grant execute on function public.request_link(text, text, text) to authenticated;
grant execute on function public.accept_link_request(uuid) to authenticated;
grant execute on function public.reject_link_request(uuid) to authenticated;
grant execute on function public.cancel_link_request(uuid) to authenticated;
grant execute on function public.submit_weekly_review(date, public.review_difficulty, jsonb, text, text) to authenticated;
grant execute on function public.respond_weekly_review(uuid, jsonb) to authenticated;
grant execute on function public.ai_check_and_increment(int) to authenticated;
