-- 1) Anonymous direct read of `branches` — drop the anon policy.
--    Public clients must use the `branches_public` view, which already exposes only safe columns.
DROP POLICY IF EXISTS "branches anon safe read" ON public.branches;

-- 2) Restrict public read of `settings` to a known safe subset of keys.
DROP POLICY IF EXISTS "settings public read" ON public.settings;
CREATE POLICY "settings public read safe keys" ON public.settings
  FOR SELECT
  USING (key IN ('general', 'delivery', 'contacts', 'flash_sale'));

-- 3) Branch admins should be able to access branch-scoped data for their own branch.
CREATE OR REPLACE FUNCTION public.can_access_branch(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.has_role(_user_id, 'super_admin')
      OR (
        _branch_id IS NOT NULL
        AND public.user_branch(_user_id) = _branch_id
        AND public.has_role(_user_id, 'admin')
      )
$function$;