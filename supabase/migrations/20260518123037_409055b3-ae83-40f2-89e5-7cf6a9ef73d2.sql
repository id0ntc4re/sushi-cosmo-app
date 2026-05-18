
-- branch_stock
CREATE TABLE public.branch_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, ingredient_id)
);
ALTER TABLE public.branch_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branch_stock scoped all" ON public.branch_stock FOR ALL TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id))
  WITH CHECK (public.can_access_branch(auth.uid(), branch_id));

-- stock_transfers
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id uuid NOT NULL,
  to_branch_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  qty numeric NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers scoped select" ON public.stock_transfers FOR SELECT TO authenticated
  USING (public.can_access_branch(auth.uid(), from_branch_id) OR public.can_access_branch(auth.uid(), to_branch_id));
CREATE POLICY "transfers scoped insert" ON public.stock_transfers FOR INSERT TO authenticated
  WITH CHECK (public.can_access_branch(auth.uid(), from_branch_id));
CREATE POLICY "transfers super delete" ON public.stock_transfers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- stock_writeoffs
CREATE TABLE public.stock_writeoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  qty numeric NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_writeoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "writeoffs scoped all" ON public.stock_writeoffs FOR ALL TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id))
  WITH CHECK (public.can_access_branch(auth.uid(), branch_id));

-- inventory_counts
CREATE TABLE public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  counted numeric NOT NULL,
  expected numeric NOT NULL DEFAULT 0,
  diff numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory scoped all" ON public.inventory_counts FOR ALL TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id))
  WITH CHECK (public.can_access_branch(auth.uid(), branch_id));

-- expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL,
  note text,
  created_by uuid,
  spent_at date NOT NULL DEFAULT (now()::date),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses scoped all" ON public.expenses FOR ALL TO authenticated
  USING (public.can_access_branch(auth.uid(), branch_id))
  WITH CHECK (public.can_access_branch(auth.uid(), branch_id));

CREATE INDEX idx_branch_stock_branch ON public.branch_stock(branch_id);
CREATE INDEX idx_transfers_created ON public.stock_transfers(created_at DESC);
CREATE INDEX idx_writeoffs_branch ON public.stock_writeoffs(branch_id, created_at DESC);
CREATE INDEX idx_inventory_branch ON public.inventory_counts(branch_id, created_at DESC);
CREATE INDEX idx_expenses_branch ON public.expenses(branch_id, spent_at DESC);
