
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches public read" ON public.branches FOR SELECT USING (true);
CREATE POLICY "branches super_admin all" ON public.branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.branches (id, name, address, sort_order)
VALUES ('00000000-0000-0000-0000-000000000001', 'Главный филиал', 'пр-т Шахтёров, 68', 0);

ALTER TABLE public.user_roles ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.cash_shifts ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.couriers ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

UPDATE public.orders SET branch_id = '00000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
UPDATE public.cash_shifts SET branch_id = '00000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;
UPDATE public.couriers SET branch_id = '00000000-0000-0000-0000-000000000001' WHERE branch_id IS NULL;

CREATE INDEX idx_orders_branch ON public.orders(branch_id);
CREATE INDEX idx_shifts_branch ON public.cash_shifts(branch_id);

CREATE OR REPLACE FUNCTION public.user_branch(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.user_roles
   WHERE user_id = _user_id AND role = 'admin'
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin')
      OR (_branch_id IS NOT NULL AND public.user_branch(_user_id) = _branch_id)
$$;

DROP POLICY IF EXISTS "orders admin update" ON public.orders;
DROP POLICY IF EXISTS "orders admin delete" ON public.orders;
DROP POLICY IF EXISTS "orders own select" ON public.orders;

CREATE POLICY "orders select scoped" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.can_access_branch(auth.uid(), branch_id));
CREATE POLICY "orders update scoped" ON public.orders FOR UPDATE TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id));
CREATE POLICY "orders delete scoped" ON public.orders FOR DELETE TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "shifts admin all" ON public.cash_shifts;
CREATE POLICY "shifts scoped all" ON public.cash_shifts FOR ALL TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id))
  WITH CHECK (public.can_access_branch(auth.uid(), branch_id));

DROP POLICY IF EXISTS "items admin manage" ON public.order_items;
CREATE POLICY "items admin manage scoped" ON public.order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
                   AND public.can_access_branch(auth.uid(), o.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
                   AND public.can_access_branch(auth.uid(), o.branch_id)));

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users
 WHERE lower(email) = lower('parsikovevgenij470@gmail.com')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_super_admin_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = lower('parsikovevgenij470@gmail.com') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grant_super_admin ON auth.users;
CREATE TRIGGER trg_grant_super_admin AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_super_admin_on_signup();
