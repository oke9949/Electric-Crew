create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table if not exists public.companies (
id uuid primary key default gen_random_uuid(),
name text not null,
created_at timestamptz not null default now()
);
create table if not exists public.profiles (
id uuid primary key references auth.users(id) on delete cascade,
display_name text not null,
role text not null default 'MEMBER',
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.company_members (
company_id uuid not null references public.companies(id) on delete cascade,
user_id uuid not null references public.profiles(id) on delete cascade,
role text not null default 'MEMBER',
status text not null default 'ACTIVE',
created_at timestamptz not null default now(),
primary key (company_id, user_id)
);
create table if not exists public.teams (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
name text not null,
created_at timestamptz not null default now()
);
create table if not exists public.projects (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
name text not null,
project_code text,
client_name text,
location text,
hall text,
start_date date,
due_date date,
progress integer not null default 0,
active boolean not null default true,
notes text,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.systems (
id uuid primary key default gen_random_uuid(),
project_id uuid not null references public.projects(id) on delete cascade,
code text not null,
name text,
discipline text,
status text not null default 'PLANNED',
progress integer not null default 0,
notes text,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.tasks (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
project_id uuid references public.projects(id) on delete set null,
system_id uuid references public.systems(id) on delete set null,
title text not null,
status text not null default 'NEW',
priority text not null default 'NORMAL',
progress integer not null default 0,
assigned_to uuid references public.profiles(id) on delete set null,
due_date date,
blocked_reason text,
notes text,
created_by uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.materials (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
name text not null,
sku text,
unit text not null default 'db',
stock_quantity numeric not null default 0,
min_stock_quantity numeric not null default 0,
average_price numeric not null default 0,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.material_requests (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
material_id uuid references public.materials(id) on delete set null,
project_id uuid references public.projects(id) on delete set null,
system_id uuid references public.systems(id) on delete set null,
requested_by uuid references public.profiles(id) on delete set null,
description text not null,
quantity numeric not null default 1,
unit text not null default 'db',
status text not null default 'REQUESTED',
notes text,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.material_transactions (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
material_id uuid not null references public.materials(id) on delete restrict,
project_id uuid references public.projects(id) on delete set null,
quantity numeric not null check (quantity > 0),
transaction_type text not null,
note text,
created_by uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now()
);
create table if not exists public.work_logs (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
user_id uuid not null references public.profiles(id) on delete cascade,
project_id uuid references public.projects(id) on delete set null,
system_id uuid references public.systems(id) on delete set null,
work_date date not null default current_date,
hours numeric not null check (hours > 0 and hours <= 24),
note text,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.documents (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
project_id uuid references public.projects(id) on delete set null,
system_id uuid references public.systems(id) on delete set null,
uploaded_by uuid references public.profiles(id) on delete set null,
file_name text not null,
storage_path text not null unique,
mime_type text,
file_size bigint,
description text,
document_type text,
ai_summary text,
ai_fields jsonb not null default '{}'::jsonb,
created_at timestamptz not null default now()
);
create table if not exists public.notifications (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
user_id uuid not null references public.profiles(id) on delete cascade,
type text not null default 'INFO',
title text not null,
body text,
read_at timestamptz,
created_at timestamptz not null default now()
);
create table if not exists public.problems (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
project_id uuid references public.projects(id) on delete set null,
title text not null,
description text,
priority text not null default 'NORMAL',
status text not null default 'OPEN',
created_by uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.help_requests (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
project_id uuid references public.projects(id) on delete set null,
title text not null,
description text,
urgency text not null default 'NORMAL',
status text not null default 'OPEN',
created_by uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.tool_requests (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
title text not null,
description text,
quantity integer not null default 1,
status text not null default 'REQUESTED',
created_by uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.procurements (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
project_id uuid references public.projects(id) on delete set null,
title text not null,
quantity numeric not null default 1,
unit text not null default 'db',
supplier text,
estimated_cost numeric not null default 0,
status text not null default 'PROPOSAL',
created_by uuid references public.profiles(id) on delete set null,
approved_by uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.clients (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
name text not null,
contact_name text,
email text,
phone text,
address text,
created_by uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
create table if not exists public.quotes (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
client_id uuid references public.clients(id) on delete set null,
number text not null,
client_name text,
title text,
net_total numeric not null default 0,
status text not null default 'DRAFT',
valid_until date,
created_by uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique (company_id, number)
);
create table if not exists public.invoices (
id uuid primary key default gen_random_uuid(),
company_id uuid not null references public.companies(id) on delete cascade,
client_id uuid references public.clients(id) on delete set null,
quote_id uuid references public.quotes(id) on delete set null,
number text not null,
client_name text,
title text,
net_total numeric not null default 0,
status text not null default 'DRAFT',
due_date date,
paid_at timestamptz,
created_by uuid references public.profiles(id) on delete set null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique (company_id, number)
);
create table if not exists public.audit_events (
id bigint generated by default as identity primary key,
company_id uuid not null references public.companies(id) on delete cascade,
actor_id uuid references public.profiles(id) on delete set null,
event_type text not null,
entity_type text,
entity_id text,
message text not null,
metadata jsonb not null default '{}'::jsonb,
created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.company_members add column if not exists role text not null default 'MEMBER';
alter table public.company_members add column if not exists status text not null default 'ACTIVE';
alter table public.company_members add column if not exists created_at timestamptz not null default now();
alter table public.teams add column if not exists created_at timestamptz not null default now();
alter table public.projects add column if not exists project_code text;
alter table public.projects add column if not exists client_name text;
alter table public.projects add column if not exists location text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists due_date date;
alter table public.projects add column if not exists notes text;
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.systems add column if not exists name text;
alter table public.systems add column if not exists status text not null default 'PLANNED';
alter table public.systems add column if not exists notes text;
alter table public.systems add column if not exists created_at timestamptz not null default now();
alter table public.systems add column if not exists updated_at timestamptz not null default now();
alter table public.tasks add column if not exists system_id uuid references public.systems(id) on delete set null;
alter table public.tasks add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.tasks add column if not exists due_date date;
alter table public.tasks add column if not exists notes text;
alter table public.materials add column if not exists sku text;
alter table public.materials add column if not exists stock_quantity numeric not null default 0;
alter table public.materials add column if not exists min_stock_quantity numeric not null default 0;
alter table public.materials add column if not exists average_price numeric not null default 0;
alter table public.materials add column if not exists updated_at timestamptz not null default now();
alter table public.tool_requests add column if not exists title text;
alter table public.tool_requests add column if not exists description text;
alter table public.tool_requests add column if not exists status text not null default 'REQUESTED';
alter table public.tool_requests add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.tool_requests add column if not exists updated_at timestamptz not null default now();
alter table public.procurements add column if not exists title text;
alter table public.procurements add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.procurements add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.procurements add column if not exists updated_at timestamptz not null default now();
alter table public.documents add column if not exists document_type text;
alter table public.documents add column if not exists ai_summary text;
alter table public.documents add column if not exists ai_fields jsonb not null default '{}'::jsonb;
do $$
begin
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='materials' and column_name='quantity') then
execute 'update public.materials set stock_quantity = quantity where stock_quantity = 0 and quantity is not null';
end if;
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='materials' and column_name='minimum') then
execute 'update public.materials set min_stock_quantity = minimum where min_stock_quantity = 0 and minimum is not null';
end if;
if exists (select 1 from information_schema.columns where table_schema='public' and table_name='tool_requests' and column_name='raw_text') then
execute 'update public.tool_requests set title = raw_text where title is null';
end if;
end $$;
update public.tool_requests set title = 'Szerszámigény' where title is null;
update public.procurements set title = 'Beszerzés' where title is null;
alter table public.projects drop constraint if exists projects_progress_check;
alter table public.projects add constraint projects_progress_check check (progress between 0 and 100) not valid;
alter table public.projects validate constraint projects_progress_check;
alter table public.systems drop constraint if exists systems_progress_check;
alter table public.systems add constraint systems_progress_check check (progress between 0 and 100) not valid;
alter table public.systems validate constraint systems_progress_check;
alter table public.tasks drop constraint if exists tasks_progress_check;
alter table public.tasks add constraint tasks_progress_check check (progress between 0 and 100) not valid;
alter table public.tasks validate constraint tasks_progress_check;
create index if not exists company_members_user_idx on public.company_members(user_id, status);
create index if not exists projects_company_active_idx on public.projects(company_id, active);
create index if not exists systems_project_idx on public.systems(project_id);
create index if not exists tasks_company_status_idx on public.tasks(company_id, status, due_date);
create index if not exists materials_company_stock_idx on public.materials(company_id, stock_quantity);
create index if not exists work_logs_company_date_idx on public.work_logs(company_id, work_date desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, company_id, read_at);
create index if not exists audit_events_company_created_idx on public.audit_events(company_id, created_at desc);
create index if not exists invoices_company_status_idx on public.invoices(company_id, status, due_date);
create or replace function private.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
select exists (
select 1 from public.company_members cm
where cm.company_id = target_company_id
and cm.user_id = (select auth.uid())
and cm.status = 'ACTIVE'
);
$$;
create or replace function private.can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
select exists (
select 1 from public.company_members cm
where cm.company_id = target_company_id
and cm.user_id = (select auth.uid())
and cm.status = 'ACTIVE'
and cm.role in ('OWNER','ADMIN','MANAGER')
);
$$;
revoke all on function private.is_company_member(uuid) from public, anon;
revoke all on function private.can_manage_company(uuid) from public, anon;
grant execute on function private.is_company_member(uuid) to authenticated;
grant execute on function private.can_manage_company(uuid) to authenticated;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
insert into public.profiles(id, display_name)
values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email,''), '@', 1), 'Felhasználó'))
on conflict (id) do nothing;
return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
create or replace function public.create_company_with_owner(company_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_company_id uuid;
begin
if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
if nullif(trim(company_name),'') is null then raise exception 'Company name is required'; end if;
insert into public.profiles(id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(coalesce(u.email,''), '@', 1), 'Felhasználó')
from auth.users u where u.id = (select auth.uid())
on conflict (id) do nothing;
insert into public.companies(name) values (trim(company_name)) returning id into new_company_id;
insert into public.company_members(company_id,user_id,role,status)
values(new_company_id,(select auth.uid()),'OWNER','ACTIVE');
return new_company_id;
end;
$$;
revoke all on function public.create_company_with_owner(text) from public, anon;
grant execute on function public.create_company_with_owner(text) to authenticated;
create or replace function public.get_my_companies()
returns table(company_id uuid, company_name text, role text, status text)
language sql
stable
security invoker
set search_path = ''
as $$
select c.id, c.name, cm.role, cm.status
from public.company_members cm
join public.companies c on c.id=cm.company_id
where cm.user_id=(select auth.uid()) and cm.status='ACTIVE'
order by c.name;
$$;
create or replace function public.get_unread_notification_count()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
select count(*) from public.notifications
where user_id=(select auth.uid()) and read_at is null;
$$;
create or replace function public.mark_notification_read(notification_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
update public.notifications set read_at=coalesce(read_at,now())
where id=notification_id and user_id=(select auth.uid());
$$;
create or replace function public.get_company_dashboard(target_company_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
select jsonb_build_object(
'active_projects',(select count(*) from public.projects where company_id=target_company_id and active),
'system_count',(select count(*) from public.systems s join public.projects p on p.id=s.project_id where p.company_id=target_company_id),
'open_tasks',(select count(*) from public.tasks where company_id=target_company_id and status not in ('DONE','CANCELLED')),
'blocked_tasks',(select count(*) from public.tasks where company_id=target_company_id and status='BLOCKED'),
'open_material_requests',(select count(*) from public.material_requests where company_id=target_company_id and status='REQUESTED'),
'low_stock_items',(select count(*) from public.materials where company_id=target_company_id and stock_quantity<=min_stock_quantity),
'hours_last_7_days',(select coalesce(sum(hours),0) from public.work_logs where company_id=target_company_id and work_date>=current_date-6)
)
where private.is_company_member(target_company_id);
$$;
grant execute on function public.get_my_companies() to authenticated;
grant execute on function public.get_unread_notification_count() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.get_company_dashboard(uuid) to authenticated;
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end;
$$;
do $$
declare table_name text;
begin
foreach table_name in array array['profiles','projects','systems','tasks','materials','material_requests','work_logs','problems','help_requests','tool_requests','procurements','clients','quotes','invoices']
loop
execute format('drop trigger if exists set_updated_at on public.%I',table_name);
execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',table_name);
end loop;
end $$;
create or replace function private.apply_material_transaction()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
if new.transaction_type='ISSUE' then
update public.materials set stock_quantity=stock_quantity-new.quantity where id=new.material_id and company_id=new.company_id;
else
update public.materials set stock_quantity=stock_quantity+new.quantity where id=new.material_id and company_id=new.company_id;
end if;
return new;
end;
$$;
revoke all on function private.apply_material_transaction() from public, anon, authenticated;
drop trigger if exists apply_material_transaction on public.material_transactions;
create trigger apply_material_transaction after insert on public.material_transactions
for each row execute function private.apply_material_transaction();
create or replace view public.project_dashboard
with (security_invoker=true)
as
select p.*,
(select count(*) from public.systems s where s.project_id=p.id) as system_count,
(select count(*) from public.tasks t where t.project_id=p.id) as task_count
from public.projects p;
create or replace view public.system_dashboard
with (security_invoker=true)
as
select s.*,p.company_id,p.project_code,p.name as project_name,
(select count(*) from public.tasks t where t.system_id=s.id) as task_count,
(select coalesce(sum(w.hours),0) from public.work_logs w where w.system_id=s.id) as logged_hours
from public.systems s join public.projects p on p.id=s.project_id;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;
alter table public.systems enable row level security;
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
using (private.is_company_member(id));
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
using (private.can_manage_company(id)) with check (private.can_manage_company(id));
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
id=(select auth.uid()) or exists (
select 1 from public.company_members mine
join public.company_members theirs on theirs.company_id=mine.company_id
where mine.user_id=(select auth.uid()) and mine.status='ACTIVE' and theirs.user_id=profiles.id
)
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id=(select auth.uid())) with check (id=(select auth.uid()));
drop policy if exists company_members_select on public.company_members;
create policy company_members_select on public.company_members for select to authenticated
using (private.is_company_member(company_id));
drop policy if exists company_members_insert on public.company_members;
create policy company_members_insert on public.company_members for insert to authenticated
with check (private.can_manage_company(company_id));
drop policy if exists company_members_update on public.company_members;
create policy company_members_update on public.company_members for update to authenticated
using (private.can_manage_company(company_id)) with check (private.can_manage_company(company_id));
drop policy if exists company_members_delete on public.company_members;
create policy company_members_delete on public.company_members for delete to authenticated
using (private.can_manage_company(company_id) and user_id<>(select auth.uid()));
drop policy if exists systems_select on public.systems;
create policy systems_select on public.systems for select to authenticated
using (exists(select 1 from public.projects p where p.id=systems.project_id and private.is_company_member(p.company_id)));
drop policy if exists systems_insert on public.systems;
create policy systems_insert on public.systems for insert to authenticated
with check (exists(select 1 from public.projects p where p.id=systems.project_id and private.is_company_member(p.company_id)));
drop policy if exists systems_update on public.systems;
create policy systems_update on public.systems for update to authenticated
using (exists(select 1 from public.projects p where p.id=systems.project_id and private.is_company_member(p.company_id)))
with check (exists(select 1 from public.projects p where p.id=systems.project_id and private.is_company_member(p.company_id)));
drop policy if exists systems_delete on public.systems;
create policy systems_delete on public.systems for delete to authenticated
using (exists(select 1 from public.projects p where p.id=systems.project_id and private.can_manage_company(p.company_id)));
do $$
declare table_name text;
begin
foreach table_name in array array[
'teams','projects','tasks','materials','material_requests','material_transactions','work_logs',
'documents','notifications','problems','help_requests','tool_requests','procurements',
'clients','quotes','invoices','audit_events'
]
loop
execute format('alter table public.%I enable row level security',table_name);
execute format('drop policy if exists company_select on public.%I',table_name);
execute format('create policy company_select on public.%I for select to authenticated using (private.is_company_member(company_id))',table_name);
execute format('drop policy if exists company_insert on public.%I',table_name);
execute format('create policy company_insert on public.%I for insert to authenticated with check (private.is_company_member(company_id))',table_name);
execute format('drop policy if exists company_update on public.%I',table_name);
execute format('create policy company_update on public.%I for update to authenticated using (private.is_company_member(company_id)) with check (private.is_company_member(company_id))',table_name);
execute format('drop policy if exists company_delete on public.%I',table_name);
execute format('create policy company_delete on public.%I for delete to authenticated using (private.can_manage_company(company_id))',table_name);
end loop;
end $$;
drop policy if exists company_update on public.work_logs;
create policy company_update on public.work_logs for update to authenticated
using (user_id=(select auth.uid()) or private.can_manage_company(company_id))
with check (user_id=(select auth.uid()) or private.can_manage_company(company_id));
drop policy if exists company_select on public.notifications;
create policy company_select on public.notifications for select to authenticated
using (user_id=(select auth.uid()));
drop policy if exists company_update on public.notifications;
create policy company_update on public.notifications for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
do $$
declare table_name text;
begin
foreach table_name in array array['clients','quotes','invoices']
loop
execute format('drop policy if exists company_select on public.%I',table_name);
execute format('create policy company_select on public.%I for select to authenticated using (private.can_manage_company(company_id))',table_name);
execute format('drop policy if exists company_insert on public.%I',table_name);
execute format('create policy company_insert on public.%I for insert to authenticated with check (private.can_manage_company(company_id))',table_name);
execute format('drop policy if exists company_update on public.%I',table_name);
execute format('create policy company_update on public.%I for update to authenticated using (private.can_manage_company(company_id)) with check (private.can_manage_company(company_id))',table_name);
execute format('drop policy if exists company_delete on public.%I',table_name);
execute format('create policy company_delete on public.%I for delete to authenticated using (private.can_manage_company(company_id))',table_name);
end loop;
end $$;
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
grant select on public.project_dashboard, public.system_dashboard to authenticated;
insert into storage.buckets(id,name,public)
values('company-documents','company-documents',false)
on conflict(id) do update set public=false;
drop policy if exists company_documents_select on storage.objects;
create policy company_documents_select on storage.objects for select to authenticated
using (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.is_company_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists company_documents_insert on storage.objects;
create policy company_documents_insert on storage.objects for insert to authenticated
with check (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.is_company_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists company_documents_update on storage.objects;
create policy company_documents_update on storage.objects for update to authenticated
using (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.is_company_member(((storage.foldername(name))[1])::uuid)
)
with check (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.is_company_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists company_documents_delete on storage.objects;
create policy company_documents_delete on storage.objects for delete to authenticated
using (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.can_manage_company(((storage.foldername(name))[1])::uuid)
);