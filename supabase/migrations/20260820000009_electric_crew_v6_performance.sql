create index if not exists help_requests_project_idx on public.help_requests(project_id);
create index if not exists invoices_client_idx on public.invoices(client_id);
create index if not exists problems_project_idx on public.problems(project_id);
create index if not exists procurements_project_idx on public.procurements(project_id);
create index if not exists quotes_client_idx on public.quotes(client_id);
drop policy if exists ai_conversations_delete_owner_or_admin on public.ai_conversations;
create policy ai_conversations_delete_owner_or_admin on public.ai_conversations for delete to authenticated
using (user_id=(select auth.uid()) or private.is_company_admin(company_id));
drop policy if exists ai_conversations_insert_member on public.ai_conversations;
create policy ai_conversations_insert_member on public.ai_conversations for insert to authenticated
with check (private.is_company_member(company_id) and user_id=(select auth.uid()));
drop policy if exists ai_conversations_update_owner on public.ai_conversations;
create policy ai_conversations_update_owner on public.ai_conversations for update to authenticated
using (user_id=(select auth.uid()) and private.is_company_member(company_id))
with check (user_id=(select auth.uid()) and private.is_company_member(company_id));
drop policy if exists ai_messages_delete_owner_or_admin on public.ai_messages;
create policy ai_messages_delete_owner_or_admin on public.ai_messages for delete to authenticated
using (exists(select 1 from public.ai_conversations c where c.id=ai_messages.conversation_id and (c.user_id=(select auth.uid()) or private.is_company_admin(c.company_id))));
drop policy if exists ai_messages_insert_owner on public.ai_messages;
create policy ai_messages_insert_owner on public.ai_messages for insert to authenticated
with check (exists(select 1 from public.ai_conversations c where c.id=ai_messages.conversation_id and c.user_id=(select auth.uid()) and private.is_company_member(c.company_id)));
