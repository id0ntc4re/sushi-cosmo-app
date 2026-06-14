ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS kkt_payments_place text,
  ADD COLUMN IF NOT EXISTS kkt_payments_address text;