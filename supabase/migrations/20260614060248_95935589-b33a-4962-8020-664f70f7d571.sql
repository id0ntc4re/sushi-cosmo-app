
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS kkt_url text,
  ADD COLUMN IF NOT EXISTS kkt_tax_system text NOT NULL DEFAULT 'usn_income',
  ADD COLUMN IF NOT EXISTS kkt_vat text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS kkt_operator_name text NOT NULL DEFAULT 'Кассир',
  ADD COLUMN IF NOT EXISTS kkt_operator_inn text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fiscal_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fiscal_payload jsonb;
