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
alter function public.get_my_companies() security invoker;
alter function public.get_my_companies() set search_path = '';
alter function public.get_unread_notification_count() security invoker;
alter function public.get_unread_notification_count() set search_path = '';
alter function public.mark_notification_read(uuid) security invoker;
alter function public.mark_notification_read(uuid) set search_path = '';
alter function public.get_company_dashboard(uuid) security invoker;
alter function public.get_company_dashboard(uuid) set search_path = '';
grant execute on function public.get_my_companies() to authenticated;
grant execute on function public.get_unread_notification_count() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.get_company_dashboard(uuid) to authenticated;
