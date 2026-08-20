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
