
-- 1. Couriers: remove public read
DROP POLICY IF EXISTS "couriers public read" ON public.couriers;
CREATE POLICY "couriers staff read" ON public.couriers
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.can_access_branch(auth.uid(), branch_id)
  );

-- 2. Branches: hide email column from anon
REVOKE SELECT ON public.branches FROM anon;
GRANT SELECT (id, name, address, phone, is_active, sort_order, created_at) ON public.branches TO anon;

-- 3. Promo codes: hide user_id column from anon
REVOKE SELECT ON public.promo_codes FROM anon;
GRANT SELECT (id, code, discount_type, discount_value, min_order, starts_at, expires_at, max_uses, used_count, is_active, created_at) ON public.promo_codes TO anon;

-- 4. Order items: ownership check on insert
DROP POLICY IF EXISTS "items insert" ON public.order_items;
CREATE POLICY "items insert" ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          (o.user_id IS NULL AND auth.uid() IS NULL)
          OR o.user_id = auth.uid()
          OR public.can_access_branch(auth.uid(), o.branch_id)
        )
    )
  );

-- 5. Callback requests: tighten public insert
DROP POLICY IF EXISTS "callback public insert" ON public.callback_requests;
CREATE POLICY "callback public insert" ON public.callback_requests
  FOR INSERT
  WITH CHECK (
    name IS NOT NULL AND char_length(name) BETWEEN 1 AND 100
    AND phone IS NOT NULL AND char_length(phone) BETWEEN 4 AND 32
  );

-- 6. Storage: remove public listing of product-images (direct URLs still work)
DROP POLICY IF EXISTS "product images public read" ON storage.objects;

-- 7. Lock down RPC-exposed SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.post_purchase_invoice(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_prepared_costs() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_writeoff_schedule(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepared_ingredient_cost(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.product_cost(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expand_product(uuid, uuid, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_branch(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_super_admin_on_signup() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_stock_on_order_item_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_order_item() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.return_stock_on_order_item_delete() FROM anon, authenticated;
