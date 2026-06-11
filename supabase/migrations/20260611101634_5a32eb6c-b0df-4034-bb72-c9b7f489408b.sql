
-- Заготовки/соусы собственного производства
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS is_prepared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prep_yield numeric NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.ingredient_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  component_ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  qty numeric NOT NULL CHECK (qty > 0),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_ingredient_id <> component_ingredient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ingredient_components_unique_idx
  ON public.ingredient_components(parent_ingredient_id,
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    component_ingredient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredient_components TO authenticated;
GRANT ALL ON public.ingredient_components TO service_role;

ALTER TABLE public.ingredient_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredient_components admin all"
  ON public.ingredient_components TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER ingredient_components_updated
  BEFORE UPDATE ON public.ingredient_components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- expand_product: рекурсивно раскрываем И вложенные продукты, И заготовки
CREATE OR REPLACE FUNCTION public.expand_product(_product_id uuid, _branch_id uuid, _multiplier numeric)
 RETURNS TABLE(ingredient_id uuid, qty numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE
  eff_recipes AS (
    SELECT r.product_id, r.ingredient_id, r.component_product_id, r.qty
    FROM public.recipes r
    WHERE r.branch_id = _branch_id
       OR (r.branch_id IS NULL AND NOT EXISTS (
           SELECT 1 FROM public.recipes r2
           WHERE r2.product_id = r.product_id AND r2.branch_id = _branch_id))
  ),
  eff_ing_comp AS (
    SELECT ic.parent_ingredient_id, ic.component_ingredient_id, ic.qty,
           COALESCE(NULLIF(i.prep_yield,0), 1) AS prep_yield
    FROM public.ingredient_components ic
    JOIN public.ingredients i ON i.id = ic.parent_ingredient_id
    WHERE ic.branch_id = _branch_id
       OR (ic.branch_id IS NULL AND NOT EXISTS (
           SELECT 1 FROM public.ingredient_components ic2
           WHERE ic2.parent_ingredient_id = ic.parent_ingredient_id AND ic2.branch_id = _branch_id))
  ),
  walk_prod(product_id, mult) AS (
    SELECT _product_id, _multiplier
    UNION ALL
    SELECT e.component_product_id, w.mult * e.qty
    FROM walk_prod w JOIN eff_recipes e
      ON e.product_id = w.product_id AND e.component_product_id IS NOT NULL
  ),
  raw_ing AS (
    SELECT e.ingredient_id AS ing_id, SUM(w.mult * e.qty)::numeric AS mult
    FROM walk_prod w JOIN eff_recipes e
      ON e.product_id = w.product_id AND e.ingredient_id IS NOT NULL
    GROUP BY e.ingredient_id
  ),
  walk_ing(ing_id, mult) AS (
    SELECT ing_id, mult FROM raw_ing
    UNION ALL
    SELECT ic.component_ingredient_id, w.mult * ic.qty / ic.prep_yield
    FROM walk_ing w
    JOIN eff_ing_comp ic ON ic.parent_ingredient_id = w.ing_id
  )
  SELECT w.ing_id AS ingredient_id, SUM(w.mult)::numeric AS qty
  FROM walk_ing w
  JOIN public.ingredients i ON i.id = w.ing_id
  WHERE COALESCE(i.is_prepared, false) = false
  GROUP BY w.ing_id;
$$;

-- Себестоимость заготовки = сумма(компонент.qty * cost) / yield (рекурсивно)
CREATE OR REPLACE FUNCTION public.prepared_ingredient_cost(_ingredient_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  total numeric := 0;
  yield numeric;
  r RECORD;
  sub numeric;
BEGIN
  SELECT COALESCE(NULLIF(prep_yield,0),1) INTO yield FROM public.ingredients WHERE id = _ingredient_id;
  FOR r IN
    SELECT ic.component_ingredient_id AS cid, ic.qty, i.is_prepared, i.cost_price
    FROM public.ingredient_components ic
    JOIN public.ingredients i ON i.id = ic.component_ingredient_id
    WHERE ic.parent_ingredient_id = _ingredient_id AND ic.branch_id IS NULL
  LOOP
    IF r.is_prepared THEN
      sub := public.prepared_ingredient_cost(r.cid);
    ELSE
      sub := COALESCE(r.cost_price, 0);
    END IF;
    total := total + r.qty * sub;
  END LOOP;
  RETURN (total / yield)::numeric;
END $$;

-- Пересчёт cost_price у всех заготовок
CREATE OR REPLACE FUNCTION public.recompute_prepared_costs()
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.ingredients WHERE is_prepared = true LOOP
    UPDATE public.ingredients
       SET cost_price = public.prepared_ingredient_cost(r.id), updated_at = now()
     WHERE id = r.id;
  END LOOP;
END $$;
