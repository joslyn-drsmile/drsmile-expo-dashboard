alter table public.expo_packages
  drop constraint if exists expo_packages_image_path_check;

comment on column public.expo_packages.image_path is
  'Optional private Storage path. An empty string means no package image has been added yet.';
