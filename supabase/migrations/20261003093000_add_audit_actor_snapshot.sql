alter table public.expo_audit_logs
  add column if not exists actor_name text,
  add column if not exists actor_email text;

alter table public.expo_audit_logs
  alter column actor_id set default auth.uid();

alter policy expo_audit_team_insert on public.expo_audit_logs
  with check (public.expo_has_access() and actor_id = (select auth.uid()));
