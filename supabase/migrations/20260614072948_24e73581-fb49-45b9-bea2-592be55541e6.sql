
-- 1. fiscal_receipts
CREATE TABLE public.fiscal_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
  fiscal_document_number text,
  fiscal_sign text,
  fiscal_receipt_number text,
  fn_number text,
  shift_number integer,
  receipt_datetime timestamptz,
  ofd_receipt_url text,
  payment_method text,
  total numeric(12,2),
  vat text,
  taxation_type text,
  operator_name text,
  operator_inn text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiscal_receipts_order ON public.fiscal_receipts(order_id);
CREATE INDEX idx_fiscal_receipts_branch ON public.fiscal_receipts(branch_id);
CREATE INDEX idx_fiscal_receipts_shift ON public.fiscal_receipts(shift_id);
CREATE INDEX idx_fiscal_receipts_fd ON public.fiscal_receipts(fiscal_document_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_receipts TO authenticated;
GRANT ALL ON public.fiscal_receipts TO service_role;

ALTER TABLE public.fiscal_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branch staff can view fiscal receipts"
  ON public.fiscal_receipts FOR SELECT TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id));

CREATE POLICY "Branch staff can insert fiscal receipts"
  ON public.fiscal_receipts FOR INSERT TO authenticated
  WITH CHECK (public.can_access_branch(auth.uid(), branch_id));

CREATE POLICY "Branch staff can update fiscal receipts"
  ON public.fiscal_receipts FOR UPDATE TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id));

-- 2. cash_shifts fiscal fields
ALTER TABLE public.cash_shifts
  ADD COLUMN IF NOT EXISTS shift_number integer,
  ADD COLUMN IF NOT EXISTS opened_fd text,
  ADD COLUMN IF NOT EXISTS opened_fp text,
  ADD COLUMN IF NOT EXISTS opened_at_fiscal timestamptz,
  ADD COLUMN IF NOT EXISTS opened_raw jsonb,
  ADD COLUMN IF NOT EXISTS closed_fd text,
  ADD COLUMN IF NOT EXISTS closed_fp text,
  ADD COLUMN IF NOT EXISTS closed_at_fiscal timestamptz,
  ADD COLUMN IF NOT EXISTS closed_raw jsonb;
