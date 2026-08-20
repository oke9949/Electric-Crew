do $$
declare r record;
begin
for r in
select tablename,policyname from pg_policies
where schemaname='public'
and tablename in (
'companies','profiles','company_members','systems','teams','projects','tasks','materials',
'material_requests','material_transactions','work_logs','documents','notifications','problems',
'help_requests','tool_requests','procurements','clients','quotes','invoices','audit_events'
)
and not (
(tablename='companies' and policyname in ('companies_select','companies_update'))
or (tablename='profiles' and policyname in ('profiles_select','profiles_update'))
or (tablename='company_members' and policyname in ('company_members_select','company_members_insert','company_members_update','company_members_delete'))
or (tablename='systems' and policyname in ('systems_select','systems_insert','systems_update','systems_delete'))
or (tablename not in ('companies','profiles','company_members','systems') and policyname in ('company_select','company_insert','company_update','company_delete'))
)
loop
execute format('drop policy if exists %I on public.%I',r.policyname,r.tablename);
end loop;
end $$;
revoke all on function public.is_company_member(uuid) from public, anon, authenticated;
revoke all on function public.is_company_admin(uuid) from public, anon, authenticated;
revoke all on function public.is_my_company(uuid) from public, anon, authenticated;
revoke update on public.profiles from authenticated;
grant update(display_name,updated_at) on public.profiles to authenticated;
create or replace function private.create_company_with_owner(company_name text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare new_company_id uuid;
begin
if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
if nullif(trim(company_name),'') is null then raise exception 'Company name is required'; end if;
insert into public.profiles(id,display_name)
select u.id,coalesce(u.raw_user_meta_data->>'display_name',split_part(coalesce(u.email,''),'@',1),'Felhasználó')
from auth.users u where u.id=(select auth.uid())
on conflict(id) do nothing;
insert into public.companies(name) values(trim(company_name)) returning id into new_company_id;
insert into public.company_members(company_id,user_id,role,status)
values(new_company_id,(select auth.uid()),'OWNER','ACTIVE');
return new_company_id;
end;
$$;
revoke all on function private.create_company_with_owner(text) from public,anon;
grant execute on function private.create_company_with_owner(text) to authenticated;
create or replace function public.create_company_with_owner(company_name text)
returns uuid
language sql
security invoker
set search_path=''
as $$
select private.create_company_with_owner(company_name);
$$;
revoke all on function public.create_company_with_owner(text) from public,anon;
grant execute on function public.create_company_with_owner(text) to authenticated;
drop index if exists public.projects_company_active_idx;
drop index if exists public.systems_project_idx;
drop index if exists public.work_logs_company_date_idx;
create index if not exists problems_company_project_status_idx on public.problems(company_id,project_id,status);
create index if not exists problems_created_by_idx on public.problems(created_by);
create index if not exists help_requests_company_project_status_idx on public.help_requests(company_id,project_id,status);
create index if not exists help_requests_created_by_idx on public.help_requests(created_by);
create index if not exists tool_requests_company_status_idx on public.tool_requests(company_id,status);
create index if not exists tool_requests_created_by_idx on public.tool_requests(created_by);
create index if not exists procurements_company_project_status_idx on public.procurements(company_id,project_id,status);
create index if not exists procurements_created_by_idx on public.procurements(created_by);
create index if not exists procurements_approved_by_idx on public.procurements(approved_by);
create index if not exists clients_company_idx on public.clients(company_id);
create index if not exists clients_created_by_idx on public.clients(created_by);
create index if not exists quotes_company_client_status_idx on public.quotes(company_id,client_id,status);
create index if not exists quotes_created_by_idx on public.quotes(created_by);
create index if not exists invoices_company_client_status_due_idx on public.invoices(company_id,client_id,status,due_date);
create index if not exists invoices_quote_idx on public.invoices(quote_id);
create index if not exists invoices_created_by_idx on public.invoices(created_by);
create index if not exists audit_events_actor_idx on public.audit_events(actor_id);
