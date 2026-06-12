
-- Defense in depth: tighten promo_codes public read policy so even if SELECT
-- were granted to anon, user-assigned codes are not enumerable by others.
DROP POLICY IF EXISTS "promo public read active" ON public.promo_codes;
CREATE POLICY "promo public read active"
  ON public.promo_codes
  FOR SELECT
  USING (
    is_active = true
    AND (
      user_id IS NULL
      OR user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Allow anonymous order owners (user_id IS NULL) to read their own order items
-- in the same session pattern already used for inserts.
DROP POLICY IF EXISTS "items select via order" ON public.order_items;
CREATE POLICY "items select via order"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.user_id = auth.uid()
          OR (o.user_id IS NULL AND auth.uid() IS NULL)
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

-- Branches: ensure anon cannot read the phone or email columns even if a
-- table-level SELECT grant is ever (re-)added. Revoke any column-level
-- SELECT and re-grant only the safe columns.
REVOKE SELECT ON public.branches FROM anon;
GRANT SELECT (id, name, address, is_active, sort_order) ON public.branches TO anon;
