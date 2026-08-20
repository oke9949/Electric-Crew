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
