-- Growth platform + diagnostics foundation
-- Date: 2026-02-16

-- Core growth tables
create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  step_key text not null,
  step_data jsonb not null default '{}'::jsonb,
  source_channel text not null default 'direct',
  completed boolean not null default false,
  last_error jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, step_key)
);

create index if not exists onboarding_sessions_patient_updated
  on public.onboarding_sessions(patient_id, updated_at desc);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  nutri_id uuid not null references public.nutris(id) on delete cascade,
  title text not null,
  description text not null default '',
  visibility text not null default 'private_clinic' check (visibility in ('private_clinic')),
  starts_on date not null default current_date,
  ends_on date null,
  reward_badge text null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists challenges_nutri_status
  on public.challenges(nutri_id, status, starts_on desc);

create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'completed', 'left')),
  progress int not null default 0,
  created_at timestamptz not null default now(),
  unique (challenge_id, patient_id)
);

create index if not exists challenge_participants_patient
  on public.challenge_participants(patient_id, status, enrolled_at desc);

create table if not exists public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  mission_date date not null default current_date,
  mission_key text not null,
  title text not null,
  target_value int not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (patient_id, mission_date, mission_key)
);

create index if not exists daily_missions_patient_date
  on public.daily_missions(patient_id, mission_date desc);

create table if not exists public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  mission_id uuid not null references public.daily_missions(id) on delete cascade,
  mission_date date not null,
  completion_key text not null,
  value int not null default 1,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (patient_id, mission_date, completion_key)
);

create index if not exists mission_completions_patient_date
  on public.mission_completions(patient_id, mission_date desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  locale text not null default 'es' check (locale in ('es', 'eu')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_active
  on public.push_subscriptions(user_id, active, updated_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid null references public.push_subscriptions(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error text null,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_user_created
  on public.notification_deliveries(user_id, created_at desc);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null default '',
  enabled boolean not null default false,
  rollout_pct int not null default 0 check (rollout_pct >= 0 and rollout_pct <= 100),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  variant text not null,
  context jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default now(),
  unique (experiment_key, user_id)
);

create index if not exists experiment_assignments_user
  on public.experiment_assignments(user_id, assigned_at desc);

create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete set null,
  route text null,
  component text null,
  severity text not null default 'error' check (severity in ('warning', 'error', 'fatal')),
  error_name text not null,
  error_message text not null,
  error_code text null,
  stack text null,
  fingerprint text null,
  context jsonb not null default '{}'::jsonb,
  environment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_error_events_user_created
  on public.app_error_events(user_id, created_at desc);

create index if not exists app_error_events_fingerprint_created
  on public.app_error_events(fingerprint, created_at desc);

-- Updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_onboarding_sessions_updated_at on public.onboarding_sessions;
create trigger set_onboarding_sessions_updated_at
before update on public.onboarding_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_challenges_updated_at on public.challenges;
create trigger set_challenges_updated_at
before update on public.challenges
for each row execute function public.set_updated_at();

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_feature_flags_updated_at on public.feature_flags;
create trigger set_feature_flags_updated_at
before update on public.feature_flags
for each row execute function public.set_updated_at();

-- RLS enablement
alter table public.onboarding_sessions enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.daily_missions enable row level security;
alter table public.mission_completions enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.feature_flags enable row level security;
alter table public.experiment_assignments enable row level security;
alter table public.app_error_events enable row level security;

-- Grants
revoke all on public.onboarding_sessions from anon, authenticated;
revoke all on public.challenges from anon, authenticated;
revoke all on public.challenge_participants from anon, authenticated;
revoke all on public.daily_missions from anon, authenticated;
revoke all on public.mission_completions from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;
revoke all on public.feature_flags from anon, authenticated;
revoke all on public.experiment_assignments from anon, authenticated;
revoke all on public.app_error_events from anon, authenticated;

grant select, insert, update on public.onboarding_sessions to authenticated;
grant select, insert, update on public.challenges to authenticated;
grant select, insert, update on public.challenge_participants to authenticated;
grant select, insert, update on public.daily_missions to authenticated;
grant select, insert, update on public.mission_completions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert on public.notification_deliveries to authenticated;
grant select on public.feature_flags to authenticated;
grant select, insert on public.experiment_assignments to authenticated;
grant insert, select on public.app_error_events to authenticated;

-- Policies: onboarding_sessions
drop policy if exists onboarding_sessions_select_self on public.onboarding_sessions;
create policy onboarding_sessions_select_self
  on public.onboarding_sessions for select
  to authenticated
  using (patient_id = auth.uid());

drop policy if exists onboarding_sessions_mutate_self on public.onboarding_sessions;
create policy onboarding_sessions_mutate_self
  on public.onboarding_sessions for all
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- Policies: challenges
drop policy if exists challenges_select_participants on public.challenges;
create policy challenges_select_participants
  on public.challenges for select
  to authenticated
  using (
    nutri_id = auth.uid()
    or exists (
      select 1
      from public.challenge_participants cp
      where cp.challenge_id = public.challenges.id
        and cp.patient_id = auth.uid()
    )
  );

drop policy if exists challenges_mutate_owner on public.challenges;
create policy challenges_mutate_owner
  on public.challenges for all
  to authenticated
  using (nutri_id = auth.uid())
  with check (nutri_id = auth.uid());

-- Policies: challenge_participants
drop policy if exists challenge_participants_select_participants on public.challenge_participants;
create policy challenge_participants_select_participants
  on public.challenge_participants for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1
      from public.challenges c
      where c.id = public.challenge_participants.challenge_id
        and c.nutri_id = auth.uid()
    )
  );

drop policy if exists challenge_participants_mutate_owner_or_self on public.challenge_participants;
create policy challenge_participants_mutate_owner_or_self
  on public.challenge_participants for all
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1
      from public.challenges c
      where c.id = public.challenge_participants.challenge_id
        and c.nutri_id = auth.uid()
    )
  )
  with check (
    patient_id = auth.uid()
    or exists (
      select 1
      from public.challenges c
      where c.id = public.challenge_participants.challenge_id
        and c.nutri_id = auth.uid()
    )
  );

-- Policies: daily_missions
drop policy if exists daily_missions_select_participants on public.daily_missions;
create policy daily_missions_select_participants
  on public.daily_missions for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.daily_missions.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

drop policy if exists daily_missions_mutate_self on public.daily_missions;
create policy daily_missions_mutate_self
  on public.daily_missions for all
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- Policies: mission_completions
drop policy if exists mission_completions_select_participants on public.mission_completions;
create policy mission_completions_select_participants
  on public.mission_completions for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.mission_completions.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

drop policy if exists mission_completions_mutate_self on public.mission_completions;
create policy mission_completions_mutate_self
  on public.mission_completions for all
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- Policies: push_subscriptions
drop policy if exists push_subscriptions_select_self on public.push_subscriptions;
create policy push_subscriptions_select_self
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists push_subscriptions_mutate_self on public.push_subscriptions;
create policy push_subscriptions_mutate_self
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policies: notification_deliveries
drop policy if exists notification_deliveries_select_self on public.notification_deliveries;
create policy notification_deliveries_select_self
  on public.notification_deliveries for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notification_deliveries_insert_self on public.notification_deliveries;
create policy notification_deliveries_insert_self
  on public.notification_deliveries for insert
  to authenticated
  with check (user_id = auth.uid());

-- Policies: feature_flags
drop policy if exists feature_flags_select_all on public.feature_flags;
create policy feature_flags_select_all
  on public.feature_flags for select
  to authenticated
  using (true);

-- Policies: experiment_assignments
drop policy if exists experiment_assignments_select_self on public.experiment_assignments;
create policy experiment_assignments_select_self
  on public.experiment_assignments for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists experiment_assignments_insert_self on public.experiment_assignments;
create policy experiment_assignments_insert_self
  on public.experiment_assignments for insert
  to authenticated
  with check (user_id = auth.uid());

-- Policies: app_error_events
drop policy if exists app_error_events_select_self on public.app_error_events;
create policy app_error_events_select_self
  on public.app_error_events for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists app_error_events_insert_self_or_null on public.app_error_events;
create policy app_error_events_insert_self_or_null
  on public.app_error_events for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- Mission helpers (idempotent daily generation + completion)
create or replace function public.ensure_daily_missions(p_day date default current_date)
returns setof public.daily_missions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'patient' then raise exception 'only_patient'; end if;

  insert into public.daily_missions(patient_id, mission_date, mission_key, title, target_value, metadata)
  values
    (v_user_id, coalesce(p_day, current_date), 'checkin', 'Registrar check-in del dia', 1, '{"icon":"target"}'::jsonb),
    (v_user_id, coalesce(p_day, current_date), 'hydration', 'Hidratacion express (500ml)', 1, '{"icon":"droplets"}'::jsonb),
    (v_user_id, coalesce(p_day, current_date), 'movement', 'Movimiento suave (10 min)', 1, '{"icon":"activity"}'::jsonb)
  on conflict (patient_id, mission_date, mission_key) do nothing;

  return query
  select dm.*
  from public.daily_missions dm
  where dm.patient_id = v_user_id
    and dm.mission_date = coalesce(p_day, current_date)
  order by dm.created_at asc;
end;
$$;

create or replace function public.complete_daily_mission(
  p_mission_id uuid,
  p_value int default 1,
  p_completion_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_mission public.daily_missions%rowtype;
  v_key text;
  v_completion_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'patient' then raise exception 'only_patient'; end if;

  select * into v_mission
  from public.daily_missions
  where id = p_mission_id
  for update;

  if not found then raise exception 'mission_not_found'; end if;
  if v_mission.patient_id is distinct from v_user_id then raise exception 'not_your_mission'; end if;

  v_key := coalesce(nullif(trim(p_completion_key), ''), v_mission.mission_key);

  insert into public.mission_completions(
    patient_id,
    mission_id,
    mission_date,
    completion_key,
    value,
    source,
    metadata,
    completed_at
  ) values (
    v_user_id,
    v_mission.id,
    v_mission.mission_date,
    v_key,
    greatest(1, coalesce(p_value, 1)),
    'manual',
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (patient_id, mission_date, completion_key)
  do update
    set value = excluded.value,
        metadata = excluded.metadata,
        completed_at = now()
  returning id into v_completion_id;

  insert into public.patient_daily_actions(patient_id, action_date, action_key, metadata, completed_at)
  values (v_user_id, v_mission.mission_date, v_mission.mission_key, coalesce(p_metadata, '{}'::jsonb), now())
  on conflict (patient_id, action_date, action_key)
  do update set completed_at = now(), metadata = excluded.metadata;

  return v_completion_id;
end;
$$;

create or replace function public.get_patient_home_payload(p_day date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_day date;
  v_week_start date;
  v_week_end date;
  v_completed int;
  v_checkins int;
  v_adherence numeric;
  v_streak int;
  v_last_symptoms record;
  v_goal_target int;
  v_goal_current int;
  v_goal_status text;
  v_nudge text;
  v_missions jsonb;
  v_active_challenges int;
  v_completed_missions_today int;
  v_reward_level text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'patient' then raise exception 'only_patient'; end if;

  v_day := coalesce(p_day, current_date);
  v_week_start := public.week_start_monday(v_day);
  v_week_end := v_week_start + 7;

  perform public.ensure_daily_missions(v_day);

  select count(*) into v_completed
  from public.patient_daily_actions
  where patient_id = v_user_id and action_date = v_day;

  select count(*),
    coalesce(avg(case adherence when 'cumpli' then 1 when 'a_medias' then 0.5 when 'no' then 0 else null end), 0)
  into v_checkins, v_adherence
  from public.logs
  where patient_id = v_user_id
    and type = 'checkin'
    and logged_at >= v_week_start::timestamptz
    and logged_at < v_week_end::timestamptz;

  with days as (
    select d::date as day
    from generate_series(v_day - 30, v_day, interval '1 day') d
  ), marked as (
    select day,
      exists (
        select 1 from public.patient_daily_actions pda
        where pda.patient_id = v_user_id and pda.action_date = day
      ) as did_action
    from days
    order by day desc
  )
  select coalesce(count(*),0)
  into v_streak
  from marked
  where day >= (
    select coalesce(min(day), v_day + 1)
    from marked m2
    where m2.day <= v_day and not m2.did_action
  )
  and did_action;

  select bloating, reflux, stress
  into v_last_symptoms
  from public.symptoms
  where patient_id = v_user_id
  order by logged_on desc
  limit 1;

  insert into public.patient_goal_weeks(patient_id, week_start, goal_type, target_value, current_value, status)
  values (v_user_id, v_week_start, 'checkins_per_week', 5, v_checkins,
    case when v_checkins >= 5 then 'completed' else 'active' end)
  on conflict (patient_id, week_start, goal_type)
  do update set current_value = excluded.current_value,
    status = case when excluded.current_value >= public.patient_goal_weeks.target_value then 'completed' else 'active' end;

  select target_value, current_value, status
  into v_goal_target, v_goal_current, v_goal_status
  from public.patient_goal_weeks
  where patient_id = v_user_id and week_start = v_week_start and goal_type = 'checkins_per_week';

  select coalesce(count(*), 0)
  into v_active_challenges
  from public.challenge_participants cp
  join public.challenges c on c.id = cp.challenge_id
  where cp.patient_id = v_user_id
    and cp.status = 'active'
    and c.status = 'active'
    and c.starts_on <= v_day
    and (c.ends_on is null or c.ends_on >= v_day);

  select coalesce(count(*), 0)
  into v_completed_missions_today
  from public.mission_completions mc
  where mc.patient_id = v_user_id
    and mc.mission_date = v_day;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', dm.id,
        'mission_key', dm.mission_key,
        'title', dm.title,
        'target_value', dm.target_value,
        'completed',
          exists (
            select 1 from public.mission_completions mc
            where mc.mission_id = dm.id
              and mc.patient_id = v_user_id
              and mc.mission_date = dm.mission_date
          )
      )
      order by dm.created_at
    ),
    '[]'::jsonb
  )
  into v_missions
  from public.daily_missions dm
  where dm.patient_id = v_user_id
    and dm.mission_date = v_day;

  if coalesce(v_last_symptoms.stress, 0) >= 3 then
    v_nudge := 'Tu estres esta alto. Prioriza una comida simple hoy y registra como te fue.';
  elsif v_goal_current < 2 then
    v_nudge := 'Empieza pequeno: un check-in rapido hoy te devuelve control.';
  elsif v_adherence < 0.5 then
    v_nudge := 'Esta semana necesita ajuste. Elige una accion minima para repetir 3 dias.';
  else
    v_nudge := 'Vas bien. Repite lo que ya te esta funcionando hoy.';
  end if;

  v_reward_level :=
    case
      when v_streak >= 14 then 'gold'
      when v_streak >= 7 then 'silver'
      when v_streak >= 3 then 'bronze'
      else 'starter'
    end;

  return jsonb_build_object(
    'date', v_day,
    'week_start', v_week_start,
    'daily_score', least(v_completed * 35, 100),
    'streak_days', greatest(v_streak, 0),
    'week_checkins', v_checkins,
    'week_adherence_pct', round(v_adherence * 100),
    'goal', jsonb_build_object(
      'type', 'checkins_per_week',
      'target', coalesce(v_goal_target, 5),
      'current', coalesce(v_goal_current, 0),
      'status', coalesce(v_goal_status, 'active')
    ),
    'latest_symptoms', jsonb_build_object(
      'stress', coalesce(v_last_symptoms.stress, 0),
      'bloating', coalesce(v_last_symptoms.bloating, 0),
      'reflux', coalesce(v_last_symptoms.reflux, 0)
    ),
    'next_best_action',
      case
        when v_completed = 0 then 'checkin'
        when v_completed = 1 then 'photo'
        else 'review_plan'
      end,
    'nudge', v_nudge,
    'missions_today', coalesce(v_missions, '[]'::jsonb),
    'streak_protection_available', (v_streak >= 5 and v_completed_missions_today >= 2),
    'weekly_challenge_status', jsonb_build_object(
      'active', v_active_challenges,
      'missions_completed_today', v_completed_missions_today
    ),
    'reward_level', v_reward_level
  );
end;
$$;

revoke execute on function public.ensure_daily_missions(date) from public;
revoke execute on function public.complete_daily_mission(uuid, int, text, jsonb) from public;
grant execute on function public.ensure_daily_missions(date) to authenticated;
grant execute on function public.complete_daily_mission(uuid, int, text, jsonb) to authenticated;
