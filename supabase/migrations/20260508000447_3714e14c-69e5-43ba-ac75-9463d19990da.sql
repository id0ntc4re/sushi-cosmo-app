
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN(tags);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can subscribe"
ON public.newsletter_subscribers FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "admins read subscribers"
ON public.newsletter_subscribers FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
