-- Prevent inventory movements from being applied twice on databases that still
-- carry the legacy trigger name alongside the canonical v6 trigger.
drop trigger if exists trg_material_transaction_stock on public.material_transactions;
