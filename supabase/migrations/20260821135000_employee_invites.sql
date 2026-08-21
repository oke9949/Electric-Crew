create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null default 'MEMBER' check (role in ('MEMBER','MANAGER')),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REVOKED')),
  token_hash text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists company_invites_pending_email_uq
  on public.company_invites (company_id, lower(email))
  where status = 'PENDING';

create index if not exists company_invites_email_status_idx
  on public.company_invites (lower(email), status, expires_at);

alter table public.company_invites enable row level security;

drop policy if exists company_invites_manage_select on public.company_invites;
create policy company_invites_manage_select on public.company_invites
for select to authenticated
using (private.can_manage_company(company_id));

drop policy if exists company_invites_manage_insert on public.company_invites;
create policy company_invites_manage_insert on public.company_invites
for insert to authenticated
with check (private.can_manage_company(company_id) and invited_by = (select auth.uid()));

drop policy if exists company_invites_manage_update on public.company_invites;
create policy company_invites_manage_update on public.company_invites
for update to authenticated
using (private.can_manage_company(company_id))
with check (private.can_manage_company(company_id));

grant select, insert, update on public.company_invites to authenticated;

create or replace function public.create_company_invite(
  target_company_id uuid,
  target_email text,
  target_role text default 'MEMBER'
)
returns table(invite_id uuid, activation_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(target_email));
  invite_token text := encode(gen_random_bytes(18), 'hex');
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not private.can_manage_company(target_company_id) then
    raise exception 'Insufficient permissions';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid email address';
  end if;
  if target_role not in ('MEMBER','MANAGER') then
    raise exception 'Invalid invite role';
  end if;

  update public.company_invites
  set status = 'REVOKED'
  where company_id = target_company_id
    and lower(email) = normalized_email
    and status = 'PENDING';

  insert into public.company_invites(company_id,email,role,status,token_hash,invited_by)
  values (
    target_company_id,
    normalized_email,
    target_role,
    'PENDING',
    encode(digest(invite_token, 'sha256'), 'hex'),
    (select auth.uid())
  )
  returning id into new_id;

  return query select new_id, invite_token;
end;
$$;

revoke all on function public.create_company_invite(uuid,text,text) from public, anon;
grant execute on function public.create_company_invite(uuid,text,text) to authenticated;

create or replace function public.revoke_company_invite(target_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_company uuid;
begin
  select company_id into target_company
  from public.company_invites
  where id = target_invite_id;

  if target_company is null or not private.can_manage_company(target_company) then
    raise exception 'Insufficient permissions';
  end if;

  update public.company_invites
  set status = 'REVOKED'
  where id = target_invite_id and status = 'PENDING';
end;
$$;

revoke all on function public.revoke_company_invite(uuid) from public, anon;
grant execute on function public.revoke_company_invite(uuid) to authenticated;
