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
