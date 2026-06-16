
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;

CREATE POLICY "super_admin manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
