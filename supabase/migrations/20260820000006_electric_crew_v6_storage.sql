insert into storage.buckets(id,name,public)
values('company-documents','company-documents',false)
on conflict(id) do update set public=false;
drop policy if exists company_documents_select on storage.objects;
create policy company_documents_select on storage.objects for select to authenticated
using (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.is_company_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists company_documents_insert on storage.objects;
create policy company_documents_insert on storage.objects for insert to authenticated
with check (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.is_company_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists company_documents_update on storage.objects;
create policy company_documents_update on storage.objects for update to authenticated
using (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.is_company_member(((storage.foldername(name))[1])::uuid)
)
with check (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.is_company_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists company_documents_delete on storage.objects;
create policy company_documents_delete on storage.objects for delete to authenticated
using (
bucket_id='company-documents'
and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
and private.can_manage_company(((storage.foldername(name))[1])::uuid)
);
