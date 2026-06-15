
GRANT SELECT ON public.branches TO authenticated;
GRANT SELECT (id, name, address, phone, email, is_active, sort_order, created_at, is_demo) ON public.branches TO anon;
GRANT ALL ON public.branches TO service_role;
