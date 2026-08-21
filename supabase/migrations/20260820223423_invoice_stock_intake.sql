alter table public.document_material_items
  add column if not exists net_amount numeric,
  add column if not exists vat_amount numeric,
  add column if not exists gross_amount numeric,
  add column if not exists material_id uuid,
  add column if not exists stock_status text not null default 'PENDING',
  add column if not exists stock_transaction_id uuid,
  add column if not exists stocked_by uuid,
  add column if not exists stocked_at timestamptz;

alter table public.material_transactions
  add column if not exists source_document_id uuid,
  add column if not exists source_document_item_id uuid,
  add column if not exists unit_price numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='document_material_items_material_id_fkey' and conrelid='public.document_material_items'::regclass) then
    alter table public.document_material_items add constraint document_material_items_material_id_fkey
      foreign key (material_id) references public.materials(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='document_material_items_stock_transaction_id_fkey' and conrelid='public.document_material_items'::regclass) then
    alter table public.document_material_items add constraint document_material_items_stock_transaction_id_fkey
      foreign key (stock_transaction_id) references public.material_transactions(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='document_material_items_stocked_by_fkey' and conrelid='public.document_material_items'::regclass) then
    alter table public.document_material_items add constraint document_material_items_stocked_by_fkey
      foreign key (stocked_by) references public.profiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='document_material_items_stock_status_check' and conrelid='public.document_material_items'::regclass) then
    alter table public.document_material_items add constraint document_material_items_stock_status_check
      check (stock_status in ('PENDING','NEEDS_REVIEW','BOOKED'));
  end if;
  if not exists (select 1 from pg_constraint where conname='document_material_items_amounts_check' and conrelid='public.document_material_items'::regclass) then
    alter table public.document_material_items add constraint document_material_items_amounts_check
      check ((net_amount is null or net_amount >= 0) and (vat_amount is null or vat_amount >= 0) and (gross_amount is null or gross_amount >= 0));
  end if;
  if not exists (select 1 from pg_constraint where conname='material_transactions_source_document_id_fkey' and conrelid='public.material_transactions'::regclass) then
    alter table public.material_transactions add constraint material_transactions_source_document_id_fkey
      foreign key (source_document_id) references public.documents(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='material_transactions_source_document_item_id_fkey' and conrelid='public.material_transactions'::regclass) then
    alter table public.material_transactions add constraint material_transactions_source_document_item_id_fkey
      foreign key (source_document_item_id) references public.document_material_items(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='material_transactions_unit_price_check' and conrelid='public.material_transactions'::regclass) then
    alter table public.material_transactions add constraint material_transactions_unit_price_check
      check (unit_price is null or unit_price >= 0);
  end if;
end $$;

update public.document_material_items
set stock_status=case
  when quantity is null or quantity <= 0 or nullif(btrim(name),'') is null or nullif(btrim(unit),'') is null or coalesce(confidence,0) < 0.6 then 'NEEDS_REVIEW'
  else 'PENDING'
end
where stock_transaction_id is null;

create index if not exists document_material_items_material_idx on public.document_material_items(material_id);
create index if not exists document_material_items_stocked_by_idx on public.document_material_items(stocked_by);
create index if not exists document_material_items_pending_document_idx on public.document_material_items(document_id,stock_status) where stock_status<>'BOOKED';
create index if not exists material_transactions_source_document_idx on public.material_transactions(source_document_id);
create unique index if not exists material_transactions_source_item_uidx on public.material_transactions(source_document_item_id) where source_document_item_id is not null;
create unique index if not exists document_material_items_stock_transaction_uidx on public.document_material_items(stock_transaction_id) where stock_transaction_id is not null;

create or replace function public.book_document_material_items(p_document_id uuid,p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_document public.documents%rowtype;
  v_item public.document_material_items%rowtype;
  v_material public.materials%rowtype;
  v_payload jsonb;
  v_item_id uuid;
  v_material_id uuid;
  v_transaction_id uuid;
  v_name text;
  v_sku text;
  v_unit text;
  v_quantity numeric;
  v_unit_price numeric;
  v_create_new boolean;
  v_booked integer:=0;
  v_already_booked integer:=0;
begin
  if (select auth.uid()) is null then raise exception 'Bejelentkezés szükséges.' using errcode='42501'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Legalább egy jóváhagyott tétel szükséges.' using errcode='22023'; end if;
  if jsonb_array_length(p_items)>500 then raise exception 'Egyszerre legfeljebb 500 tétel könyvelhető.' using errcode='22023'; end if;

  select * into v_document from public.documents where id=p_document_id for update;
  if not found then raise exception 'A forrásdokumentum nem található.' using errcode='P0002'; end if;
  if not private.can_manage_company(v_document.company_id) then raise exception 'A készletkönyveléshez vezetői jogosultság szükséges.' using errcode='42501'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_document.company_id::text,0));

  for v_payload in
    select value from jsonb_array_elements(p_items) with ordinality as entry(value,position)
    order by coalesce(value->>'materialId',''),value->>'itemId',position
  loop
    begin
      v_item_id:=(v_payload->>'itemId')::uuid;
      v_material_id:=nullif(v_payload->>'materialId','')::uuid;
      v_create_new:=coalesce((v_payload->>'createNew')::boolean,false);
      v_quantity:=(v_payload->>'quantity')::numeric;
      v_unit_price:=nullif(v_payload->>'unitPrice','')::numeric;
    exception when others then
      raise exception 'Érvénytelen tételadat érkezett.' using errcode='22023';
    end;
    v_name:=btrim(coalesce(v_payload->>'name',''));
    v_sku:=nullif(btrim(coalesce(v_payload->>'sku','')),'');
    v_unit:=btrim(coalesce(v_payload->>'unit',''));
    if v_name='' or length(v_name)>500 or v_unit='' or length(v_unit)>32 or v_quantity is null or v_quantity<=0 or v_quantity>1000000000 then
      raise exception 'A megnevezés, mennyiség vagy mértékegység hibás.' using errcode='22023';
    end if;
    if v_unit_price is not null and (v_unit_price<0 or v_unit_price>1000000000000) then
      raise exception 'Az egységár hibás.' using errcode='22023';
    end if;

    select * into v_item from public.document_material_items
    where id=v_item_id and document_id=p_document_id and company_id=v_document.company_id for update;
    if not found then raise exception 'A számlatétel nem található ebben a dokumentumban.' using errcode='P0002'; end if;
    if v_item.stock_transaction_id is not null or v_item.stock_status='BOOKED' then
      v_already_booked:=v_already_booked+1;
      continue;
    end if;

    v_material:=null;
    if v_material_id is not null then
      select * into v_material from public.materials where id=v_material_id and company_id=v_document.company_id for update;
      if not found then raise exception 'A kiválasztott raktári anyag nem található.' using errcode='P0002'; end if;
    else
      select * into v_material from public.materials m
      where m.company_id=v_document.company_id and
        ((v_sku is not null and m.sku is not null and lower(btrim(m.sku))=lower(v_sku)) or
         (lower(btrim(m.name))=lower(v_name) and lower(btrim(m.unit))=lower(v_unit)))
      order by case when v_sku is not null and m.sku is not null and lower(btrim(m.sku))=lower(v_sku) then 0 else 1 end,m.id
      limit 1 for update;
    end if;

    if v_material.id is null then
      if not v_create_new then raise exception 'A tételhez válassz meglévő anyagot vagy engedélyezd az új létrehozását.' using errcode='22023'; end if;
      insert into public.materials(company_id,name,sku,unit,stock_quantity,min_stock_quantity,average_price)
      values(v_document.company_id,v_name,v_sku,v_unit,0,0,coalesce(v_unit_price,0)) returning * into v_material;
    elsif lower(btrim(v_material.unit))<>lower(v_unit) then
      raise exception 'A kiválasztott anyag mértékegysége eltér a jóváhagyott tételtől.' using errcode='22023';
    end if;

    if v_unit_price is not null then
      update public.materials set average_price=case
        when stock_quantity+v_quantity>0 then ((stock_quantity*average_price)+(v_quantity*v_unit_price))/(stock_quantity+v_quantity)
        else v_unit_price end
      where id=v_material.id;
    end if;

    insert into public.material_transactions(company_id,material_id,project_id,quantity,transaction_type,note,created_by,source_document_id,source_document_item_id,unit_price)
    values(v_document.company_id,v_material.id,v_document.project_id,v_quantity,'RECEIPT','Számlából bevételezve: '||v_document.file_name||' · sor '||v_item.line_number,(select auth.uid()),p_document_id,v_item.id,v_unit_price)
    returning id into v_transaction_id;

    update public.document_material_items set
      name=v_name,sku=v_sku,quantity=v_quantity,unit=v_unit,unit_price=v_unit_price,
      material_id=v_material.id,stock_status='BOOKED',stock_transaction_id=v_transaction_id,
      stocked_by=(select auth.uid()),stocked_at=now(),updated_at=now()
    where id=v_item.id;
    v_booked:=v_booked+1;
  end loop;

  insert into public.audit_events(company_id,actor_id,event_type,entity_type,entity_id,message,metadata)
  values(v_document.company_id,(select auth.uid()),'DOCUMENT_STOCK_INTAKE','document',p_document_id::text,
    v_booked||' számlatétel raktárkészletre könyvelve.',jsonb_build_object('booked',v_booked,'alreadyBooked',v_already_booked,'sourceFile',v_document.file_name));

  return jsonb_build_object('documentId',p_document_id,'booked',v_booked,'alreadyBooked',v_already_booked);
end;
$$;

revoke all on function public.book_document_material_items(uuid,jsonb) from public,anon;
grant execute on function public.book_document_material_items(uuid,jsonb) to authenticated;
