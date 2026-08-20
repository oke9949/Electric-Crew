create unique index if not exists chat_channels_company_project_uidx
  on public.chat_channels(company_id, project_id)
  where kind='PROJECT' and project_id is not null;

create or replace function private.chat_channel_company_consistent(
  p_company_id uuid,
  p_project_id uuid,
  p_system_id uuid,
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (p_project_id is null or exists (
      select 1 from public.projects p where p.id=p_project_id and p.company_id=p_company_id
    ))
    and
    (p_system_id is null or exists (
      select 1
      from public.systems s
      join public.projects p on p.id=s.project_id
      where s.id=p_system_id and p.company_id=p_company_id
    ))
    and
    (p_task_id is null or exists (
      select 1 from public.tasks t where t.id=p_task_id and t.company_id=p_company_id
    ));
$$;

revoke all on function private.chat_channel_company_consistent(uuid,uuid,uuid,uuid) from public;
grant execute on function private.chat_channel_company_consistent(uuid,uuid,uuid,uuid) to authenticated;

drop policy if exists chat_channels_insert_member on public.chat_channels;
create policy chat_channels_insert_member on public.chat_channels for insert to authenticated
with check (
  private.is_company_member(company_id)
  and created_by=(select auth.uid())
  and private.chat_channel_company_consistent(company_id,project_id,system_id,task_id)
);

drop policy if exists chat_channels_update_admin on public.chat_channels;
create policy chat_channels_update_admin on public.chat_channels for update to authenticated
using (private.can_manage_company(company_id))
with check (
  private.can_manage_company(company_id)
  and private.chat_channel_company_consistent(company_id,project_id,system_id,task_id)
);

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member on public.chat_messages for insert to authenticated
with check (
  private.is_company_member(company_id)
  and sender_id=(select auth.uid())
  and exists(select 1 from public.chat_channels c where c.id=channel_id and c.company_id=chat_messages.company_id)
  and (attachment_id is null or exists(
    select 1 from public.documents d where d.id=attachment_id and d.company_id=chat_messages.company_id
  ))
);

drop policy if exists chat_messages_update_owner on public.chat_messages;
create policy chat_messages_update_owner on public.chat_messages for update to authenticated
using (sender_id=(select auth.uid()) and private.is_company_member(company_id))
with check (
  sender_id=(select auth.uid())
  and private.is_company_member(company_id)
  and exists(select 1 from public.chat_channels c where c.id=channel_id and c.company_id=chat_messages.company_id)
  and (attachment_id is null or exists(
    select 1 from public.documents d where d.id=attachment_id and d.company_id=chat_messages.company_id
  ))
);
