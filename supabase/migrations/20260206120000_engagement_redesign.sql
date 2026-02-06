-- Engagement redesign + plan v2
-- Date: 2026-02-06

-- plans v2 metadata
alter table public.plans
  add column if not exists schema_version smallint not null default 2,
  add column if not exists status text not null default 'draft' check (status in ('draft','published')),
  add column if not exists published_at timestamptz null;

update public.plans
set schema_version = 2
where schema_version is distinct from 2;

-- Daily actions completed by patient
create table if not exists public.patient_daily_actions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  action_date date not null default current_date,
  action_key text not null,
  completed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (patient_id, action_date, action_key)
);

create index if not exists patient_daily_actions_patient_date
  on public.patient_daily_actions(patient_id, action_date desc);

-- Weekly patient goals
create table if not exists public.patient_goal_weeks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  week_start date not null,
  goal_type text not null,
  target_value int not null default 5,
  current_value int not null default 0,
  status text not null default 'active' check (status in ('active','completed','missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, week_start, goal_type)
);

create index if not exists patient_goal_weeks_patient_week
  on public.patient_goal_weeks(patient_id, week_start desc);

-- Risk snapshot for nutri prioritization
create table if not exists public.patient_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  risk_level text not null check (risk_level in ('low','medium','high')),
  risk_reasons jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists patient_risk_snapshots_patient_computed
  on public.patient_risk_snapshots(patient_id, computed_at desc);

-- Product analytics events
create table if not exists public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  event_name text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists engagement_events_user_created
  on public.engagement_events(user_id, created_at desc);

create index if not exists engagement_events_name_created
  on public.engagement_events(event_name, created_at desc);

-- NPS responses
create table if not exists public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score smallint not null check (score between 0 and 10),
  comment text null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nps_responses_user_created
  on public.nps_responses(user_id, created_at desc);

-- Updated_at trigger for patient_goal_weeks
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_patient_goal_weeks_updated_at on public.patient_goal_weeks;
create trigger set_patient_goal_weeks_updated_at
before update on public.patient_goal_weeks
for each row execute function public.set_updated_at();

-- RLS enablement
alter table public.patient_daily_actions enable row level security;
alter table public.patient_goal_weeks enable row level security;
alter table public.patient_risk_snapshots enable row level security;
alter table public.engagement_events enable row level security;
alter table public.nps_responses enable row level security;

-- Grants
revoke all on public.patient_daily_actions from anon, authenticated;
revoke all on public.patient_goal_weeks from anon, authenticated;
revoke all on public.patient_risk_snapshots from anon, authenticated;
revoke all on public.engagement_events from anon, authenticated;
revoke all on public.nps_responses from anon, authenticated;

grant select, insert, update on public.patient_daily_actions to authenticated;
grant select, insert, update on public.patient_goal_weeks to authenticated;
grant select on public.patient_risk_snapshots to authenticated;
grant insert on public.engagement_events to authenticated;
grant select, insert on public.nps_responses to authenticated;

-- Policies patient_daily_actions
drop policy if exists patient_daily_actions_select_participants on public.patient_daily_actions;
create policy patient_daily_actions_select_participants
  on public.patient_daily_actions for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.patient_daily_actions.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

drop policy if exists patient_daily_actions_mutate_patient on public.patient_daily_actions;
create policy patient_daily_actions_mutate_patient
  on public.patient_daily_actions for all
  to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

-- Policies patient_goal_weeks
drop policy if exists patient_goal_weeks_select_participants on public.patient_goal_weeks;
create policy patient_goal_weeks_select_participants
  on public.patient_goal_weeks for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.patient_goal_weeks.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

drop policy if exists patient_goal_weeks_mutate_participants on public.patient_goal_weeks;
create policy patient_goal_weeks_mutate_participants
  on public.patient_goal_weeks for all
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.patient_goal_weeks.patient_id
        and ct.nutri_id = auth.uid()
    )
  )
  with check (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.patient_goal_weeks.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

-- Policies patient_risk_snapshots (nutri + patient read)
drop policy if exists patient_risk_snapshots_select_participants on public.patient_risk_snapshots;
create policy patient_risk_snapshots_select_participants
  on public.patient_risk_snapshots for select
  to authenticated
  using (
    patient_id = auth.uid()
    or exists (
      select 1 from public.care_teams ct
      where ct.patient_id = public.patient_risk_snapshots.patient_id
        and ct.nutri_id = auth.uid()
    )
  );

-- Policies engagement_events (insert self only)
drop policy if exists engagement_events_insert_self on public.engagement_events;
create policy engagement_events_insert_self
  on public.engagement_events for insert
  to authenticated
  with check (user_id = auth.uid());

-- Policies nps_responses
drop policy if exists nps_responses_select_self on public.nps_responses;
create policy nps_responses_select_self
  on public.nps_responses for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists nps_responses_insert_self on public.nps_responses;
create policy nps_responses_insert_self
  on public.nps_responses for insert
  to authenticated
  with check (user_id = auth.uid());

-- Helper: monday week start
create or replace function public.week_start_monday(p_date date)
returns date
language sql
immutable
as $$
  select (date_trunc('week', (p_date::timestamp + interval '1 day')) - interval '1 day')::date;
$$;

-- RPC complete action
create or replace function public.complete_patient_action(
  p_action_key text,
  p_action_date date default current_date,
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
  v_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'patient' then raise exception 'only_patient'; end if;

  insert into public.patient_daily_actions(patient_id, action_date, action_key, completed_at, metadata)
  values (v_user_id, coalesce(p_action_date, current_date), trim(p_action_key), now(), coalesce(p_metadata, '{}'::jsonb))
  on conflict (patient_id, action_date, action_key)
  do update set completed_at = now(), metadata = excluded.metadata
  returning id into v_id;

  return v_id;
end;
$$;

-- RPC patient home payload
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
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select role into v_role from public.profiles where id = v_user_id;
  if v_role is distinct from 'patient' then raise exception 'only_patient'; end if;

  v_day := coalesce(p_day, current_date);
  v_week_start := public.week_start_monday(v_day);
  v_week_end := v_week_start + 7;

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

  if coalesce(v_last_symptoms.stress, 0) >= 3 then
    v_nudge := 'Tu estres esta alto. Prioriza una comida simple hoy y registra como te fue.';
  elsif v_goal_current < 2 then
    v_nudge := 'Empieza pequeno: un check-in rapido hoy te devuelve control.';
  elsif v_adherence < 0.5 then
    v_nudge := 'Esta semana necesita ajuste. Elige una accion minima para repetir 3 dias.';
  else
    v_nudge := 'Vas bien. Repite lo que ya te esta funcionando hoy.';
  end if;

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
    'nudge', v_nudge
  );
end;
$$;

-- RPC nutri board payload
create or replace function public.get_nutri_board_payload()
returns setof jsonb
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
  if v_role is distinct from 'nutri' then raise exception 'only_nutri'; end if;

  return query
  with assigned as (
    select ct.patient_id
    from public.care_teams ct
    where ct.nutri_id = v_user_id
  ),
  latest_checkin as (
    select l.patient_id, max(l.logged_at) as last_checkin_at,
      avg(case adherence when 'cumpli' then 1 when 'a_medias' then 0.5 when 'no' then 0 else null end) as adherence_avg
    from public.logs l
    join assigned a on a.patient_id = l.patient_id
    where l.type = 'checkin' and l.logged_at >= now() - interval '14 days'
    group by l.patient_id
  ),
  latest_symptom as (
    select distinct on (s.patient_id) s.patient_id, s.stress, s.bloating, s.reflux, s.logged_on
    from public.symptoms s
    join assigned a on a.patient_id = s.patient_id
    order by s.patient_id, s.logged_on desc
  ),
  pending_review as (
    select wr.patient_id, bool_or(wr.responded_at is null) as has_pending_review
    from public.weekly_reviews wr
    join assigned a on a.patient_id = wr.patient_id
    where wr.week_start >= public.week_start_monday(current_date - 14)
    group by wr.patient_id
  )
  select jsonb_build_object(
    'patient_id', a.patient_id,
    'name', coalesce(p.full_name, p.email, a.patient_id::text),
    'risk_level',
      case
        when lc.last_checkin_at is null or lc.last_checkin_at < now() - interval '3 days' then 'high'
        when coalesce(ls.stress,0) >= 3 then 'high'
        when coalesce(lc.adherence_avg,1) < 0.5 then 'medium'
        else 'low'
      end,
    'risk_reasons', jsonb_build_array(
      case when lc.last_checkin_at is null then 'Sin check-ins recientes' end,
      case when lc.last_checkin_at < now() - interval '3 days' then 'Mas de 3 dias sin registro' end,
      case when coalesce(ls.stress,0) >= 3 then 'Estres alto' end,
      case when coalesce(lc.adherence_avg,1) < 0.5 then 'Adherencia baja' end,
      case when coalesce(pr.has_pending_review,false) then 'Revision pendiente' end
    ),
    'last_checkin_at', lc.last_checkin_at,
    'adherence_14d', round(coalesce(lc.adherence_avg, 0) * 100),
    'symptoms', jsonb_build_object(
      'stress', coalesce(ls.stress,0),
      'bloating', coalesce(ls.bloating,0),
      'reflux', coalesce(ls.reflux,0)
    ),
    'has_pending_review', coalesce(pr.has_pending_review, false)
  )
  from assigned a
  left join public.profiles p on p.id = a.patient_id
  left join latest_checkin lc on lc.patient_id = a.patient_id
  left join latest_symptom ls on ls.patient_id = a.patient_id
  left join pending_review pr on pr.patient_id = a.patient_id
  order by
    case
      when lc.last_checkin_at is null or lc.last_checkin_at < now() - interval '3 days' then 1
      when coalesce(ls.stress,0) >= 3 then 2
      when coalesce(lc.adherence_avg,1) < 0.5 then 3
      else 4
    end,
    coalesce(lc.last_checkin_at, 'epoch'::timestamptz) asc;
end;
$$;

-- RPC NPS submit
create or replace function public.submit_nps_response(
  p_score int,
  p_comment text,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select role into v_role from public.profiles where id = v_user_id;
  if v_role is null then raise exception 'profile_missing'; end if;

  if p_score < 0 or p_score > 10 then
    raise exception 'score_out_of_range';
  end if;

  insert into public.nps_responses(user_id, score, comment, context)
  values (v_user_id, p_score, nullif(trim(coalesce(p_comment,'')), ''), coalesce(p_context, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

-- RPC execute permissions
revoke execute on function public.complete_patient_action(text, date, jsonb) from public;
revoke execute on function public.get_patient_home_payload(date) from public;
revoke execute on function public.get_nutri_board_payload() from public;
revoke execute on function public.submit_nps_response(int, text, jsonb) from public;

grant execute on function public.complete_patient_action(text, date, jsonb) to authenticated;
grant execute on function public.get_patient_home_payload(date) to authenticated;
grant execute on function public.get_nutri_board_payload() to authenticated;
grant execute on function public.submit_nps_response(int, text, jsonb) to authenticated;

