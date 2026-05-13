
-- ===== Ingredients (склад) =====
CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'г',
  stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredients admin all" ON public.ingredients FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER ingredients_updated BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Recipes (техкарты) =====
CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  UNIQUE(product_id, ingredient_id)
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes admin all" ON public.recipes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ===== Stock movements log =====
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL,
  delta numeric NOT NULL,
  reason text NOT NULL,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements admin all" ON public.stock_movements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ===== Auto deduct stock on order item insert =====
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  FOR r IN SELECT ingredient_id, qty FROM public.recipes WHERE product_id = NEW.product_id LOOP
    UPDATE public.ingredients SET stock = stock - (r.qty * NEW.quantity) WHERE id = r.ingredient_id;
    INSERT INTO public.stock_movements(ingredient_id, delta, reason, order_id)
      VALUES (r.ingredient_id, -(r.qty * NEW.quantity), 'order', NEW.order_id);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER deduct_stock_after_order_item AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_order_item();

-- ===== Couriers =====
CREATE TABLE public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couriers admin all" ON public.couriers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "couriers public read" ON public.couriers FOR SELECT TO public USING (true);

-- ===== Delivery zones =====
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  free_from numeric,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones admin all" ON public.delivery_zones FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "zones public read" ON public.delivery_zones FOR SELECT TO public USING (true);

-- ===== Modifiers =====
CREATE TABLE public.modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modifiers admin all" ON public.modifiers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "modifiers public read" ON public.modifiers FOR SELECT TO public USING (is_active = true);

CREATE TABLE public.product_modifiers (
  product_id uuid NOT NULL,
  modifier_id uuid NOT NULL,
  PRIMARY KEY (product_id, modifier_id)
);
ALTER TABLE public.product_modifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmods admin all" ON public.product_modifiers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "pmods public read" ON public.product_modifiers FOR SELECT TO public USING (true);

-- ===== Cash shifts =====
CREATE TABLE public.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_cash numeric NOT NULL DEFAULT 0,
  closing_cash numeric,
  cash_total numeric NOT NULL DEFAULT 0,
  card_total numeric NOT NULL DEFAULT 0,
  orders_count int NOT NULL DEFAULT 0,
  note text
);
ALTER TABLE public.cash_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts admin all" ON public.cash_shifts FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ===== Orders: add courier + shift refs =====
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_id uuid,
  ADD COLUMN IF NOT EXISTS shift_id uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS done_at timestamptz;

-- ===== Realtime for kanban =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- ===== Order items: store modifiers selection =====
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS modifiers jsonb NOT NULL DEFAULT '[]'::jsonb;
