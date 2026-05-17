
CREATE TABLE public.callback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  comment text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "callback public insert" ON public.callback_requests
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "callback scoped select" ON public.callback_requests
  FOR SELECT TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id));

CREATE POLICY "callback scoped update" ON public.callback_requests
  FOR UPDATE TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id));

CREATE POLICY "callback scoped delete" ON public.callback_requests
  FOR DELETE TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id));
