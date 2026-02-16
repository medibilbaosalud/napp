-- Error dashboard RPC for nutri role
-- Date: 2026-02-16

create or replace function public.get_error_dashboard(p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_days int;
  v_since timestamptz;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_role
  from public.profiles
  where id = v_user_id;

  if v_role is distinct from 'nutri' then
    raise exception 'only_nutri';
  end if;

  v_days := greatest(1, least(coalesce(p_days, 14), 90));
  v_since := now() - make_interval(days => v_days);

  with base as (
    select
      id,
      user_id,
      created_at,
      route,
      component,
      severity,
      error_name,
      error_message,
      error_code,
      stack,
      fingerprint,
      context,
      environment
    from public.app_error_events
    where created_at >= v_since
  ),
  metrics as (
    select
      count(*)::int as total_errors,
      count(*) filter (where severity = 'fatal')::int as fatal_errors,
      count(*) filter (where severity = 'error')::int as error_errors,
      count(*) filter (where severity = 'warning')::int as warning_errors,
      count(distinct coalesce(fingerprint, error_name || ':' || coalesce(route, 'unknown')))::int as unique_issues,
      count(distinct user_id)::int as impacted_users
    from base
  ),
  by_day as (
    select
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
      count(*)::int as total,
      count(*) filter (where severity = 'fatal')::int as fatal
    from base
    group by 1
    order by day asc
  ),
  by_route as (
    select
      coalesce(route, '(unknown)') as route,
      count(*)::int as total
    from base
    group by 1
    order by total desc, route asc
    limit 20
  ),
  top_issues as (
    select
      coalesce(fingerprint, error_name || ':' || coalesce(route, 'unknown')) as issue_key,
      min(error_name) as error_name,
      min(error_message) as error_message,
      min(severity) as severity,
      min(error_code) as error_code,
      min(route) as route,
      min(component) as component,
      count(*)::int as total,
      max(created_at) as last_seen,
      min(created_at) as first_seen,
      max(case when stack is not null then left(stack, 1200) else null end) as stack_sample,
      count(distinct user_id)::int as impacted_users
    from base
    group by 1
    order by total desc, last_seen desc
    limit 25
  ),
  recent as (
    select
      id,
      created_at,
      route,
      component,
      severity,
      error_name,
      error_message,
      error_code,
      fingerprint,
      left(coalesce(stack, ''), 1200) as stack_sample,
      context,
      environment
    from base
    order by created_at desc
    limit 60
  )
  select jsonb_build_object(
    'window_days', v_days,
    'since', v_since,
    'summary', jsonb_build_object(
      'total_errors', coalesce(m.total_errors, 0),
      'fatal_errors', coalesce(m.fatal_errors, 0),
      'error_errors', coalesce(m.error_errors, 0),
      'warning_errors', coalesce(m.warning_errors, 0),
      'unique_issues', coalesce(m.unique_issues, 0),
      'impacted_users', coalesce(m.impacted_users, 0)
    ),
    'daily_trend',
      coalesce(
        (select jsonb_agg(jsonb_build_object('day', d.day, 'total', d.total, 'fatal', d.fatal) order by d.day asc) from by_day d),
        '[]'::jsonb
      ),
    'routes',
      coalesce(
        (select jsonb_agg(jsonb_build_object('route', r.route, 'total', r.total) order by r.total desc) from by_route r),
        '[]'::jsonb
      ),
    'top_issues',
      coalesce(
        (select jsonb_agg(
          jsonb_build_object(
            'issue_key', t.issue_key,
            'error_name', t.error_name,
            'error_message', t.error_message,
            'severity', t.severity,
            'error_code', t.error_code,
            'route', t.route,
            'component', t.component,
            'total', t.total,
            'impacted_users', t.impacted_users,
            'first_seen', t.first_seen,
            'last_seen', t.last_seen,
            'stack_sample', t.stack_sample
          )
          order by t.total desc, t.last_seen desc
        ) from top_issues t),
        '[]'::jsonb
      ),
    'recent',
      coalesce(
        (select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'created_at', r.created_at,
            'route', r.route,
            'component', r.component,
            'severity', r.severity,
            'error_name', r.error_name,
            'error_message', r.error_message,
            'error_code', r.error_code,
            'fingerprint', r.fingerprint,
            'stack_sample', r.stack_sample,
            'context', r.context,
            'environment', r.environment
          )
          order by r.created_at desc
        ) from recent r),
        '[]'::jsonb
      )
  )
  into v_result
  from metrics m;

  return coalesce(
    v_result,
    jsonb_build_object(
      'window_days', v_days,
      'since', v_since,
      'summary', jsonb_build_object(
        'total_errors', 0,
        'fatal_errors', 0,
        'error_errors', 0,
        'warning_errors', 0,
        'unique_issues', 0,
        'impacted_users', 0
      ),
      'daily_trend', '[]'::jsonb,
      'routes', '[]'::jsonb,
      'top_issues', '[]'::jsonb,
      'recent', '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.get_error_dashboard(int) from public;
grant execute on function public.get_error_dashboard(int) to authenticated;
