-- Electric Crew collaboration, live location and map foundation.
-- Every exposed table is protected by company-scoped RLS.

alter table public.projects
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.projects
  drop constraint if exists projects_latitude_range,
  drop constraint if exists projects_longitude_range;

alter table public.projects
  add constraint projects_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint projects_longitude_range check (longitude is null or longitude between -180 and 180);

create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  kind text not null default 'COMPANY' check (kind in ('COMPANY','PROJECT','SYSTEM','TASK')),
  project_id uuid references public.projects(id) on delete cascade,
  system_id uuid references public.systems(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (
    (kind='COMPANY' and project_id is null and system_id is null and task_id is null) or
    (kind='PROJECT' and project_id is not null and system_id is null and task_id is null) or
    (kind='SYSTEM' and system_id is not null and task_id is null) or
    (kind='TASK' and task_id is not null)
  )
);

create unique index if not exists chat_channels_company_general_uidx
  on public.chat_channels(company_id) where kind='COMPANY';
create index if not exists chat_channels_company_idx on public.chat_channels(company_id, created_at);
create index if not exists chat_channels_project_idx on public.chat_channels(project_id) where project_id is not null;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 5000),
  attachment_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists chat_messages_channel_time_idx on public.chat_messages(channel_id, created_at desc);
create index if not exists chat_messages_company_time_idx on public.chat_messages(company_id, created_at desc);

create table if not exists public.user_locations (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  sharing boolean not null default true,
  captured_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists user_locations_company_time_idx on public.user_locations(company_id, captured_at desc);

alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;
alter table public.user_locations enable row level security;

drop policy if exists chat_channels_select_member on public.chat_channels;
create policy chat_channels_select_member on public.chat_channels for select to authenticated
using (private.is_company_member(company_id));

drop policy if exists chat_channels_insert_member on public.chat_channels;
create policy chat_channels_insert_member on public.chat_channels for insert to authenticated
with check (private.is_company_member(company_id) and created_by=(select auth.uid()));

drop policy if exists chat_channels_update_admin on public.chat_channels;
create policy chat_channels_update_admin on public.chat_channels for update to authenticated
using (private.can_manage_company(company_id))
with check (private.can_manage_company(company_id));

drop policy if exists chat_channels_delete_admin on public.chat_channels;
create policy chat_channels_delete_admin on public.chat_channels for delete to authenticated
using (private.can_manage_company(company_id));

drop policy if exists chat_messages_select_member on public.chat_messages;
create policy chat_messages_select_member on public.chat_messages for select to authenticated
using (
  private.is_company_member(company_id)
  and exists(select 1 from public.chat_channels c where c.id=channel_id and c.company_id=chat_messages.company_id)
);

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member on public.chat_messages for insert to authenticated
with check (
  private.is_company_member(company_id)
  and sender_id=(select auth.uid())
  and exists(select 1 from public.chat_channels c where c.id=channel_id and c.company_id=chat_messages.company_id)
);

drop policy if exists chat_messages_update_owner on public.chat_messages;
create policy chat_messages_update_owner on public.chat_messages for update to authenticated
using (sender_id=(select auth.uid()) and private.is_company_member(company_id))
with check (sender_id=(select auth.uid()) and private.is_company_member(company_id));

drop policy if exists chat_messages_delete_owner_or_admin on public.chat_messages;
create policy chat_messages_delete_owner_or_admin on public.chat_messages for delete to authenticated
using (sender_id=(select auth.uid()) or private.is_company_admin(company_id));

drop policy if exists user_locations_select_member on public.user_locations;
create policy user_locations_select_member on public.user_locations for select to authenticated
using (private.is_company_member(company_id));

drop policy if exists user_locations_insert_self on public.user_locations;
create policy user_locations_insert_self on public.user_locations for insert to authenticated
with check (user_id=(select auth.uid()) and private.is_company_member(company_id));

drop policy if exists user_locations_update_self on public.user_locations;
create policy user_locations_update_self on public.user_locations for update to authenticated
using (user_id=(select auth.uid()) and private.is_company_member(company_id))
with check (user_id=(select auth.uid()) and private.is_company_member(company_id));

drop policy if exists user_locations_delete_self on public.user_locations;
create policy user_locations_delete_self on public.user_locations for delete to authenticated
using (user_id=(select auth.uid()));

revoke all on public.chat_channels, public.chat_messages, public.user_locations from anon;
grant select, insert, update, delete on public.chat_channels, public.chat_messages, public.user_locations to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages') then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_locations') then
      alter publication supabase_realtime add table public.user_locations;
    end if;
  end if;
end $$;
