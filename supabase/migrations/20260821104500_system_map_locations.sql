-- Store precise, user-captured map positions for technical systems.
-- Existing systems RLS remains in force: active company members may update systems
-- belonging to projects they can access.

alter table public.systems
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_captured_at timestamptz,
  add column if not exists location_updated_by uuid references public.profiles(id) on delete set null;

alter table public.systems
  drop constraint if exists systems_latitude_range,
  drop constraint if exists systems_longitude_range,
  drop constraint if exists systems_location_accuracy_nonnegative,
  drop constraint if exists systems_location_coordinate_pair;

alter table public.systems
  add constraint systems_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint systems_longitude_range check (longitude is null or longitude between -180 and 180),
  add constraint systems_location_accuracy_nonnegative check (location_accuracy_m is null or location_accuracy_m >= 0),
  add constraint systems_location_coordinate_pair check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null)
  );

create index if not exists systems_project_location_idx
  on public.systems(project_id, location_captured_at desc)
  where latitude is not null and longitude is not null;
