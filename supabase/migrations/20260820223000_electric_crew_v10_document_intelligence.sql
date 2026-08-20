create table if not exists public.document_material_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  line_number integer not null default 1,
  name text not null,
  sku text,
  quantity numeric,
  unit text,
  unit_price numeric,
  total_price numeric,
  currency text not null default 'HUF',
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  source_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, line_number)
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_document_id uuid not null references public.documents(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  entry_type text not null default 'EXPENSE' check (entry_type in ('INCOME','EXPENSE')),
  counterparty text,
  reference_number text,
  issue_date date,
  due_date date,
  net_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  gross_amount numeric not null default 0,
  currency text not null default 'HUF',
  status text not null default 'RECORDED',
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_document_id)
);

create index if not exists document_material_items_company_idx on public.document_material_items(company_id);
create index if not exists document_material_items_document_idx on public.document_material_items(document_id);
create index if not exists financial_entries_company_idx on public.financial_entries(company_id);
create index if not exists financial_entries_due_date_idx on public.financial_entries(company_id, due_date);

alter table public.document_material_items enable row level security;
alter table public.financial_entries enable row level security;

drop policy if exists company_select on public.document_material_items;
create policy company_select on public.document_material_items for select to authenticated
using (private.is_company_member(company_id));
drop policy if exists company_insert on public.document_material_items;
create policy company_insert on public.document_material_items for insert to authenticated
with check (private.is_company_member(company_id));
drop policy if exists company_update on public.document_material_items;
create policy company_update on public.document_material_items for update to authenticated
using (private.is_company_member(company_id)) with check (private.is_company_member(company_id));
drop policy if exists company_delete on public.document_material_items;
create policy company_delete on public.document_material_items for delete to authenticated
using (private.is_company_member(company_id));

drop policy if exists company_select on public.financial_entries;
create policy company_select on public.financial_entries for select to authenticated
using (private.can_manage_company(company_id));
drop policy if exists company_insert on public.financial_entries;
create policy company_insert on public.financial_entries for insert to authenticated
with check (private.can_manage_company(company_id));
drop policy if exists company_update on public.financial_entries;
create policy company_update on public.financial_entries for update to authenticated
using (private.can_manage_company(company_id)) with check (private.can_manage_company(company_id));
drop policy if exists company_delete on public.financial_entries;
create policy company_delete on public.financial_entries for delete to authenticated
using (private.can_manage_company(company_id));

grant select,insert,update,delete on public.document_material_items, public.financial_entries to authenticated;
revoke all on public.document_material_items, public.financial_entries from anon;

