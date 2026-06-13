ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS gift_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gift_product_name text,
  ADD COLUMN IF NOT EXISTS gift_product_image_url text;