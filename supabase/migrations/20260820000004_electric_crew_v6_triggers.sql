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
