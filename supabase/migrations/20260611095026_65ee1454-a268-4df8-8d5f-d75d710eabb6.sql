
-- 1. recipes: branch_id, component_product_id
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS component_product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE public.recipes ALTER COLUMN ingredient_id DROP NOT NULL;

ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_product_id_ingredient_id_key;
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_component_xor;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_component_xor
  CHECK ((ingredient_id IS NOT NULL)::int + (component_product_id IS NOT NULL)::int = 1);

CREATE UNIQUE INDEX IF NOT EXISTS recipes_unique_idx ON public.recipes (
  product_id,
  COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(ingredient_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(component_product_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- 2. products: is_semi_product
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_semi_product boolean NOT NULL DEFAULT false;

-- 3. stock_movements: branch_id
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 4. Recursive expand: product -> ingredients aggregated, per branch (with fallback to NULL-branch recipe)
CREATE OR REPLACE FUNCTION public.expand_product(_product_id uuid, _branch_id uuid, _multiplier numeric)
RETURNS TABLE(ingredient_id uuid, qty numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE eff AS (
    SELECT r.product_id, r.ingredient_id, r.component_product_id, r.qty
    FROM public.recipes r
    WHERE r.branch_id = _branch_id
       OR (r.branch_id IS NULL AND NOT EXISTS (
           SELECT 1 FROM public.recipes r2
           WHERE r2.product_id = r.product_id AND r2.branch_id = _branch_id))
  ),
  walk(product_id, mult) AS (
    SELECT _product_id, _multiplier
    UNION ALL
    SELECT e.component_product_id, w.mult * e.qty
    FROM walk w
    JOIN eff e ON e.product_id = w.product_id AND e.component_product_id IS NOT NULL
  )
  SELECT e.ingredient_id, SUM(w.mult * e.qty)::numeric AS qty
  FROM walk w
  JOIN eff e ON e.product_id = w.product_id AND e.ingredient_id IS NOT NULL
  GROUP BY e.ingredient_id;
$$;

-- 5. New deduct trigger: branch_stock
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; b uuid;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT branch_id INTO b FROM public.orders WHERE id = NEW.order_id;
  IF b IS NULL THEN RETURN NEW; END IF;
  FOR r IN SELECT * FROM public.expand_product(NEW.product_id, b, NEW.quantity::numeric) LOOP
    INSERT INTO public.branch_stock(branch_id, ingredient_id, stock)
      VALUES (b, r.ingredient_id, -r.qty)
    ON CONFLICT (branch_id, ingredient_id)
      DO UPDATE SET stock = public.branch_stock.stock - r.qty, updated_at = now();
    INSERT INTO public.stock_movements(ingredient_id, delta, reason, order_id, branch_id)
      VALUES (r.ingredient_id, -r.qty, 'order', NEW.order_id, b);
  END LOOP;
  RETURN NEW;
END $$;

-- 6. Adjust trigger on update (qty changes)
CREATE OR REPLACE FUNCTION public.adjust_stock_on_order_item_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; diff numeric; b uuid;
BEGIN
  IF NEW.product_id IS NULL OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN RETURN NEW; END IF;
  diff := (NEW.quantity - OLD.quantity)::numeric;
  IF diff = 0 THEN RETURN NEW; END IF;
  SELECT branch_id INTO b FROM public.orders WHERE id = NEW.order_id;
  IF b IS NULL THEN RETURN NEW; END IF;
  FOR r IN SELECT * FROM public.expand_product(NEW.product_id, b, diff) LOOP
    INSERT INTO public.branch_stock(branch_id, ingredient_id, stock)
      VALUES (b, r.ingredient_id, -r.qty)
    ON CONFLICT (branch_id, ingredient_id)
      DO UPDATE SET stock = public.branch_stock.stock - r.qty, updated_at = now();
    INSERT INTO public.stock_movements(ingredient_id, delta, reason, order_id, branch_id)
      VALUES (r.ingredient_id, -r.qty, CASE WHEN diff>0 THEN 'order_edit_add' ELSE 'order_edit_return' END, NEW.order_id, b);
  END LOOP;
  RETURN NEW;
END $$;

-- 7. Return on delete
CREATE OR REPLACE FUNCTION public.return_stock_on_order_item_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; b uuid;
BEGIN
  IF OLD.product_id IS NULL THEN RETURN OLD; END IF;
  SELECT branch_id INTO b FROM public.orders WHERE id = OLD.order_id;
  IF b IS NULL THEN RETURN OLD; END IF;
  FOR r IN SELECT * FROM public.expand_product(OLD.product_id, b, OLD.quantity::numeric) LOOP
    INSERT INTO public.branch_stock(branch_id, ingredient_id, stock)
      VALUES (b, r.ingredient_id, r.qty)
    ON CONFLICT (branch_id, ingredient_id)
      DO UPDATE SET stock = public.branch_stock.stock + r.qty, updated_at = now();
    INSERT INTO public.stock_movements(ingredient_id, delta, reason, order_id, branch_id)
      VALUES (r.ingredient_id, r.qty, 'order_edit_return', OLD.order_id, b);
  END LOOP;
  RETURN OLD;
END $$;

-- 8. Update purchase posting to also update branch_stock
CREATE OR REPLACE FUNCTION public.post_purchase_invoice(_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; inv RECORD;
  cur_stock numeric; cur_cost numeric; new_cost numeric; total_sum numeric := 0;
BEGIN
  SELECT * INTO inv FROM public.purchase_invoices WHERE id = _invoice_id FOR UPDATE;
  IF inv IS NULL THEN RAISE EXCEPTION 'Накладная не найдена'; END IF;
  IF inv.status = 'posted' THEN RAISE EXCEPTION 'Накладная уже проведена'; END IF;
  IF NOT public.can_access_branch(auth.uid(), inv.branch_id) THEN
    RAISE EXCEPTION 'Нет доступа к филиалу';
  END IF;

  FOR r IN SELECT * FROM public.purchase_invoice_items WHERE invoice_id = _invoice_id LOOP
    SELECT stock, cost_price INTO cur_stock, cur_cost FROM public.ingredients WHERE id = r.ingredient_id FOR UPDATE;
    IF (cur_stock + r.qty) > 0 THEN
      new_cost := (cur_stock * COALESCE(cur_cost,0) + r.qty * r.price) / (cur_stock + r.qty);
    ELSE
      new_cost := r.price;
    END IF;
    UPDATE public.ingredients
       SET stock = stock + r.qty, cost_price = new_cost, updated_at = now()
     WHERE id = r.ingredient_id;
    -- branch stock
    IF inv.branch_id IS NOT NULL THEN
      INSERT INTO public.branch_stock(branch_id, ingredient_id, stock)
        VALUES (inv.branch_id, r.ingredient_id, r.qty)
      ON CONFLICT (branch_id, ingredient_id)
        DO UPDATE SET stock = public.branch_stock.stock + r.qty, updated_at = now();
    END IF;
    INSERT INTO public.stock_movements(ingredient_id, delta, reason, branch_id)
      VALUES (r.ingredient_id, r.qty, 'purchase', inv.branch_id);
    total_sum := total_sum + r.qty * r.price;
  END LOOP;

  UPDATE public.purchase_invoices
     SET status = 'posted', posted_at = now(), total = total_sum
   WHERE id = _invoice_id;
END $$;
