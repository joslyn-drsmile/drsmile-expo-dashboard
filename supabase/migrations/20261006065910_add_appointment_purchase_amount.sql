alter table public.expo_appointments
  add column if not exists purchase_amount numeric(12, 2) not null default 0
  constraint expo_appointments_purchase_amount_nonnegative check (purchase_amount >= 0);

comment on column public.expo_appointments.purchase_amount is
  'Actual MYR sales amount attributed to this appointment. A positive value implies purchased and attended.';
