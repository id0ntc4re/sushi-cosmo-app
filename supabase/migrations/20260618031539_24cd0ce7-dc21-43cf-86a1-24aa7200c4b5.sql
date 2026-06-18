-- Fix branch isolation for stock_movements and writeoff_schedules

-- 1. stock_movements: restrict admins to their own branch
DROP POLICY IF EXISTS "stock_movements admin all" ON public.stock_movements;
CREATE POLICY "stock_movements branch scoped" ON public.stock_movements
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (branch_id IS NOT NULL AND public.can_access_branch(auth.uid(), branch_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (branch_id IS NOT NULL AND public.can_access_branch(auth.uid(), branch_id))
  );

-- 2. writeoff_schedules: restrict admins to their own branch
DROP POLICY IF EXISTS "writeoff_schedules admin" ON public.writeoff_schedules;
CREATE POLICY "writeoff_schedules branch scoped" ON public.writeoff_schedules
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR (branch_id IS NOT NULL AND public.can_access_branch(auth.uid(), branch_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR (branch_id IS NOT NULL AND public.can_access_branch(auth.uid(), branch_id))
  );