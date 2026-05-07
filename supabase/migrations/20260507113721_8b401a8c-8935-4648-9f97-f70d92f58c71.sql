
DROP POLICY "orders insert public" ON public.orders;
CREATE POLICY "orders insert" ON public.orders FOR INSERT
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY "items insert public" ON public.order_items;
CREATE POLICY "items insert" ON public.order_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id));
