create index if not exists chat_channels_created_by_idx on public.chat_channels(created_by);
create index if not exists chat_channels_system_idx on public.chat_channels(system_id) where system_id is not null;
create index if not exists chat_channels_task_idx on public.chat_channels(task_id) where task_id is not null;
create index if not exists chat_messages_attachment_idx on public.chat_messages(attachment_id) where attachment_id is not null;
create index if not exists chat_messages_sender_idx on public.chat_messages(sender_id);
create index if not exists user_locations_user_idx on public.user_locations(user_id);
