ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS calories numeric,
  ADD COLUMN IF NOT EXISTS protein numeric,
  ADD COLUMN IF NOT EXISTS fat numeric,
  ADD COLUMN IF NOT EXISTS carbs numeric;