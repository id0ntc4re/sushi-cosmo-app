
-- Fix order_items SELECT policy: was allowing any admin to read items across all branches
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
        OR public.can_access_branch(auth.uid(), o.branch_id)
      )
  )
);
