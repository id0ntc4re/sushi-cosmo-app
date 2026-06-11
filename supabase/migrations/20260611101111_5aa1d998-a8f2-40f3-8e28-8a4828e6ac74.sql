
-- 1. writeoff_mode в products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS writeoff_mode text NOT NULL DEFAULT 'ingredients';
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_writeoff_mode_check;
ALTER TABLE public.products ADD CONSTRAINT products_writeoff_mode_check
  CHECK (writeoff_mode IN ('ingredients','self'));

-- 2. branch_product_stock
CREATE TABLE IF NOT EXISTS public.branch_product_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_product_stock_branch ON public.branch_product_stock(branch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_product_stock TO authenticated;
GRANT ALL ON public.branch_product_stock TO service_role;

ALTER TABLE public.branch_product_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branch_product_stock scoped all" ON public.branch_product_stock;
CREATE POLICY "branch_product_stock scoped all" ON public.branch_product_stock
  FOR ALL TO authenticated
  USING (can_access_branch(auth.uid(), branch_id))
  WITH CHECK (can_access_branch(auth.uid(), branch_id));

-- 3. Триггеры: учитываем writeoff_mode
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; b uuid; mode text;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT branch_id INTO b FROM public.orders WHERE id = NEW.order_id;
  IF b IS NULL THEN RETURN NEW; END IF;
  SELECT writeoff_mode INTO mode FROM public.products WHERE id = NEW.product_id;

  IF mode = 'self' THEN
    INSERT INTO public.branch_product_stock(branch_id, product_id, stock)
      VALUES (b, NEW.product_id, -NEW.quantity::numeric)
    ON CONFLICT (branch_id, product_id)
      DO UPDATE SET stock = public.branch_product_stock.stock - NEW.quantity::numeric, updated_at = now();
  ELSE
    FOR r IN SELECT * FROM public.expand_product(NEW.product_id, b, NEW.quantity::numeric) LOOP
      INSERT INTO public.branch_stock(branch_id, ingredient_id, stock)
        VALUES (b, r.ingredient_id, -r.qty)
      ON CONFLICT (branch_id, ingredient_id)
        DO UPDATE SET stock = public.branch_stock.stock - r.qty, updated_at = now();
      INSERT INTO public.stock_movements(ingredient_id, delta, reason, order_id, branch_id)
        VALUES (r.ingredient_id, -r.qty, 'order', NEW.order_id, b);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.adjust_stock_on_order_item_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; diff numeric; b uuid; mode text;
BEGIN
  IF NEW.product_id IS NULL OR NEW.product_id IS DISTINCT FROM OLD.product_id THEN RETURN NEW; END IF;
  diff := (NEW.quantity - OLD.quantity)::numeric;
  IF diff = 0 THEN RETURN NEW; END IF;
  SELECT branch_id INTO b FROM public.orders WHERE id = NEW.order_id;
  IF b IS NULL THEN RETURN NEW; END IF;
  SELECT writeoff_mode INTO mode FROM public.products WHERE id = NEW.product_id;

  IF mode = 'self' THEN
    INSERT INTO public.branch_product_stock(branch_id, product_id, stock)
      VALUES (b, NEW.product_id, -diff)
    ON CONFLICT (branch_id, product_id)
      DO UPDATE SET stock = public.branch_product_stock.stock - diff, updated_at = now();
  ELSE
    FOR r IN SELECT * FROM public.expand_product(NEW.product_id, b, diff) LOOP
      INSERT INTO public.branch_stock(branch_id, ingredient_id, stock)
        VALUES (b, r.ingredient_id, -r.qty)
      ON CONFLICT (branch_id, ingredient_id)
        DO UPDATE SET stock = public.branch_stock.stock - r.qty, updated_at = now();
      INSERT INTO public.stock_movements(ingredient_id, delta, reason, order_id, branch_id)
        VALUES (r.ingredient_id, -r.qty, CASE WHEN diff>0 THEN 'order_edit_add' ELSE 'order_edit_return' END, NEW.order_id, b);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.return_stock_on_order_item_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; b uuid; mode text;
BEGIN
  IF OLD.product_id IS NULL THEN RETURN OLD; END IF;
  SELECT branch_id INTO b FROM public.orders WHERE id = OLD.order_id;
  IF b IS NULL THEN RETURN OLD; END IF;
  SELECT writeoff_mode INTO mode FROM public.products WHERE id = OLD.product_id;

  IF mode = 'self' THEN
    INSERT INTO public.branch_product_stock(branch_id, product_id, stock)
      VALUES (b, OLD.product_id, OLD.quantity::numeric)
    ON CONFLICT (branch_id, product_id)
      DO UPDATE SET stock = public.branch_product_stock.stock + OLD.quantity::numeric, updated_at = now();
  ELSE
    FOR r IN SELECT * FROM public.expand_product(OLD.product_id, b, OLD.quantity::numeric) LOOP
      INSERT INTO public.branch_stock(branch_id, ingredient_id, stock)
        VALUES (b, r.ingredient_id, r.qty)
      ON CONFLICT (branch_id, ingredient_id)
        DO UPDATE SET stock = public.branch_stock.stock + r.qty, updated_at = now();
      INSERT INTO public.stock_movements(ingredient_id, delta, reason, order_id, branch_id)
        VALUES (r.ingredient_id, r.qty, 'order_edit_return', OLD.order_id, b);
    END LOOP;
  END IF;
  RETURN OLD;
END $$;

-- 4. writeoff_schedules
CREATE TABLE IF NOT EXISTS public.writeoff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('category','product','ingredient')),
  target_id uuid NOT NULL,
  time_of_day time NOT NULL DEFAULT '23:00',
  days_of_week int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_writeoff_schedules_active ON public.writeoff_schedules(active, time_of_day);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.writeoff_schedules TO authenticated;
GRANT ALL ON public.writeoff_schedules TO service_role;

ALTER TABLE public.writeoff_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "writeoff_schedules admin" ON public.writeoff_schedules;
CREATE POLICY "writeoff_schedules admin" ON public.writeoff_schedules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS writeoff_schedules_updated ON public.writeoff_schedules;
CREATE TRIGGER writeoff_schedules_updated BEFORE UPDATE ON public.writeoff_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Функция «списать просроченные остатки» (вызывается вручную или по cron)
CREATE OR REPLACE FUNCTION public.run_writeoff_schedule(_schedule_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s RECORD;
  cnt int := 0;
  br RECORD;
BEGIN
  SELECT * INTO s FROM public.writeoff_schedules WHERE id = _schedule_id AND active = true;
  IF s IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'schedule not found or inactive'); END IF;

  FOR br IN
    SELECT id FROM public.branches WHERE s.branch_id IS NULL OR id = s.branch_id
  LOOP
    IF s.scope = 'ingredient' THEN
      INSERT INTO public.stock_writeoffs(branch_id, ingredient_id, qty, reason)
      SELECT br.id, bs.ingredient_id, bs.stock, 'auto: ' || s.name
      FROM public.branch_stock bs
      WHERE bs.branch_id = br.id AND bs.ingredient_id = s.target_id AND bs.stock > 0;
      UPDATE public.branch_stock SET stock = 0, updated_at = now()
        WHERE branch_id = br.id AND ingredient_id = s.target_id AND stock > 0;
      cnt := cnt + 1;
    ELSIF s.scope = 'product' THEN
      -- списываем именно остаток товара (для writeoff_mode='self')
      UPDATE public.branch_product_stock SET stock = 0, updated_at = now()
        WHERE branch_id = br.id AND product_id = s.target_id AND stock > 0;
      cnt := cnt + 1;
    ELSIF s.scope = 'category' THEN
      -- все товары категории с режимом 'self'
      UPDATE public.branch_product_stock bps SET stock = 0, updated_at = now()
        FROM public.products p
        WHERE bps.product_id = p.id AND p.category_id = s.target_id
          AND p.writeoff_mode = 'self' AND bps.branch_id = br.id AND bps.stock > 0;
      cnt := cnt + 1;
    END IF;
  END LOOP;

  UPDATE public.writeoff_schedules SET last_run_at = now() WHERE id = _schedule_id;
  RETURN jsonb_build_object('ok', true, 'branches_processed', cnt);
END $$;

GRANT EXECUTE ON FUNCTION public.run_writeoff_schedule(uuid) TO authenticated;
