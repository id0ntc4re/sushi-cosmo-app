ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at) WHERE deleted_at IS NULL;