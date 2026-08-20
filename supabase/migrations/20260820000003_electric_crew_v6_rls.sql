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
