
-- 1. profiles: anniversary
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS anniversary_date date;

-- 2. orders: payment + kitchen print + fiscal + holiday discount tag
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('unpaid','paid','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.holiday_discount_kind AS ENUM ('birthday','anniversary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS kitchen_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fiscal_receipt_number text,
  ADD COLUMN IF NOT EXISTS fiscal_receipt_url text,
  ADD COLUMN IF NOT EXISTS holiday_discount_kind public.holiday_discount_kind;

-- 3. order_changes log
CREATE TABLE IF NOT EXISTS public.order_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_changes_order ON public.order_changes(order_id, created_at DESC);

ALTER TABLE public.order_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_changes select scoped" ON public.order_changes;
CREATE POLICY "order_changes select scoped" ON public.order_changes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_changes.order_id
      AND public.can_access_branch(auth.uid(), o.branch_id)
  ));

DROP POLICY IF EXISTS "order_changes insert scoped" ON public.order_changes;
CREATE POLICY "order_changes insert scoped" ON public.order_changes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_changes.order_id
      AND public.can_access_branch(auth.uid(), o.branch_id)
  ));
