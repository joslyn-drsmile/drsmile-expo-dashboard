alter table public.expo_appointments
  add constraint expo_appointments_positive_amount_is_purchase
  check (purchase_amount = 0 or (purchased and attended));
