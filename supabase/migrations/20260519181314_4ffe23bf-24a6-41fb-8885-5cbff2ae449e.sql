
-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  inn text,
  contact_person text,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers admin all" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Purchase invoices
CREATE TABLE public.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  branch_id uuid,
  invoice_number text,
  invoice_date date NOT NULL DEFAULT (now())::date,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- draft | posted
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz
);
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_invoices scoped all" ON public.purchase_invoices
  FOR ALL TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id))
  WITH CHECK (public.can_access_branch(auth.uid(), branch_id));

-- Purchase invoice items
CREATE TABLE public.purchase_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  qty numeric NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_invoice_items scoped all" ON public.purchase_invoice_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_invoices pi WHERE pi.id = invoice_id AND public.can_access_branch(auth.uid(), pi.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_invoices pi WHERE pi.id = invoice_id AND public.can_access_branch(auth.uid(), pi.branch_id)));

CREATE INDEX idx_pii_invoice ON public.purchase_invoice_items(invoice_id);
CREATE INDEX idx_pi_branch ON public.purchase_invoices(branch_id);
CREATE INDEX idx_pi_status ON public.purchase_invoices(status);

-- Post invoice: add stock, log movements, recompute weighted-average cost
CREATE OR REPLACE FUNCTION public.post_purchase_invoice(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  inv RECORD;
  cur_stock numeric;
  cur_cost numeric;
  new_cost numeric;
  total_sum numeric := 0;
BEGIN
  SELECT * INTO inv FROM public.purchase_invoices WHERE id = _invoice_id FOR UPDATE;
  IF inv IS NULL THEN RAISE EXCEPTION 'Накладная не найдена'; END IF;
  IF inv.status = 'posted' THEN RAISE EXCEPTION 'Накладная уже проведена'; END IF;

  -- Check access
  IF NOT public.can_access_branch(auth.uid(), inv.branch_id) THEN
    RAISE EXCEPTION 'Нет доступа к филиалу';
  END IF;

  FOR r IN SELECT * FROM public.purchase_invoice_items WHERE invoice_id = _invoice_id LOOP
    SELECT stock, cost_price INTO cur_stock, cur_cost FROM public.ingredients WHERE id = r.ingredient_id FOR UPDATE;
    -- Weighted average
    IF (cur_stock + r.qty) > 0 THEN
      new_cost := (cur_stock * COALESCE(cur_cost,0) + r.qty * r.price) / (cur_stock + r.qty);
    ELSE
      new_cost := r.price;
    END IF;
    UPDATE public.ingredients
       SET stock = stock + r.qty,
           cost_price = new_cost,
           updated_at = now()
     WHERE id = r.ingredient_id;
    INSERT INTO public.stock_movements(ingredient_id, delta, reason)
      VALUES (r.ingredient_id, r.qty, 'purchase');
    total_sum := total_sum + r.qty * r.price;
  END LOOP;

  UPDATE public.purchase_invoices
     SET status = 'posted', posted_at = now(), total = total_sum
   WHERE id = _invoice_id;
END $$;
