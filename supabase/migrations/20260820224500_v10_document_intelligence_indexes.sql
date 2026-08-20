create index if not exists document_material_items_project_idx
  on public.document_material_items(project_id);

create index if not exists financial_entries_project_idx
  on public.financial_entries(project_id);

create index if not exists financial_entries_created_by_idx
  on public.financial_entries(created_by);

