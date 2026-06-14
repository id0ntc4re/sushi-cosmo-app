
ALTER TABLE public.fiscal_receipts
  ADD COLUMN IF NOT EXISTS receipt_type text NOT NULL DEFAULT 'sell',
  ADD COLUMN IF NOT EXISTS parent_receipt_id uuid REFERENCES public.fiscal_receipts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS items jsonb;

ALTER TABLE public.fiscal_receipts
  DROP CONSTRAINT IF EXISTS fiscal_receipts_receipt_type_check;
ALTER TABLE public.fiscal_receipts
  ADD CONSTRAINT fiscal_receipts_receipt_type_check
  CHECK (receipt_type IN ('sell','sell_refund'));

CREATE INDEX IF NOT EXISTS idx_fiscal_receipts_parent ON public.fiscal_receipts(parent_receipt_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_receipts_type ON public.fiscal_receipts(receipt_type);
