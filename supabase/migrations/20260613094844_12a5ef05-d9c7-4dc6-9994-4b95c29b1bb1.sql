
-- Restrict direct SELECT on branches to admins; expose safe columns via a view
DROP POLICY IF EXISTS "branches public read" ON public.branches;

CREATE POLICY "branches admin read"
ON public.branches
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Safe public view (no email/phone)
CREATE OR REPLACE VIEW public.branches_public
WITH (security_invoker = true) AS
SELECT id, name, address, is_active, sort_order, created_at
FROM public.branches
WHERE is_active = true;

GRANT SELECT ON public.branches_public TO anon, authenticated;

-- Ensure the view can read the base table regardless of RLS, by adding a
-- permissive read policy for the safe column set via a security-definer fn-free path:
-- Add a policy that allows public SELECT but the view will only request safe columns.
-- We re-add a public policy limited to selecting via the view's needs; since Postgres
-- can't restrict columns in policy, we keep base table admin-only and rely on the
-- security_invoker=true view + an additional policy below for anon/auth via the view.
CREATE POLICY "branches public safe read"
ON public.branches
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Revoke column-level SELECT on sensitive columns from anon/authenticated so even
-- direct queries cannot return email/phone; admins still read via super/admin policy
-- because column privileges are checked per-role: admins use the 'authenticated' role,
-- so we instead drop the safe-read policy's reach to sensitive columns via grants.
REVOKE SELECT ON public.branches FROM anon, authenticated;
GRANT SELECT (id, name, address, is_active, sort_order, created_at)
  ON public.branches TO anon, authenticated;
-- Grant full column access only to service_role (admins go through server fns or
-- specific admin pages that should be migrated to use the admin server context).
GRANT SELECT ON public.branches TO service_role;
