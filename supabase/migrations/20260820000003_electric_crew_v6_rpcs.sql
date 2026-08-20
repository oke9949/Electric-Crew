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
