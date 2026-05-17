ALTER PUBLICATION supabase_realtime ADD TABLE public.callback_requests;
ALTER TABLE public.callback_requests REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;