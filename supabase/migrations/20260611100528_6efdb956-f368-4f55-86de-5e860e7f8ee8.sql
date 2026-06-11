
CREATE OR REPLACE FUNCTION public.product_cost(_product_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(e.qty * COALESCE(i.cost_price, 0)), 0)::numeric
  FROM public.expand_product(_product_id, NULL::uuid, 1::numeric) e
  JOIN public.ingredients i ON i.id = e.ingredient_id;
$$;

GRANT EXECUTE ON FUNCTION public.product_cost(uuid) TO authenticated;
