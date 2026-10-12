alter table public.expo_appointments
  add column if not exists attention boolean not null default false,
  add column if not exists attention_reason text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'expo_appointments_attention_reason_required'
      and conrelid = 'public.expo_appointments'::regclass
  ) then
    alter table public.expo_appointments
      add constraint expo_appointments_attention_reason_required
      check (not attention or length(trim(attention_reason)) > 0);
  end if;
end
$$;

comment on column public.expo_appointments.attention is
  'Internal caution flag shown to approved dashboard staff; it does not block booking.';

comment on column public.expo_appointments.attention_reason is
  'Internal reason for an appointment attention flag.';
