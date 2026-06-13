
-- Authenticated users (admins) need full access for management pages
GRANT SELECT ON public.branches TO authenticated;

-- Anon keeps column-restricted SELECT only
-- (already set: GRANT SELECT (id, name, address, is_active, sort_order, created_at) TO anon)

-- Restrict authenticated-side SELECT to admins only via RLS so regular signed-in
-- customers still don't see email/phone
DROP POLICY IF EXISTS "branches public safe read" ON public.branches;

CREATE POLICY "branches anon safe read"
ON public.branches
FOR SELECT
TO anon
USING (is_active = true);

-- Authenticated: only admins/super_admins see rows (which include email/phone).
-- Regular logged-in customers will read branches via the branches_public view.
-- "branches admin read" policy already created in previous migration covers this.
