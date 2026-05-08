
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ingredients text;

UPDATE public.products SET description = 'Классический ролл, приготовленный по нашему фирменному рецепту. Свежие ингредиенты, нежный рис и японский соус.' WHERE description IS NULL OR description = '';
UPDATE public.products SET ingredients = 'Рис, нори, сливочный сыр, лосось, огурец, кунжут' WHERE ingredients IS NULL OR ingredients = '';
UPDATE public.products SET weight = '220 г / 8 шт' WHERE weight IS NULL OR weight = '';

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL DEFAULT '',
  image_url text,
  kind text NOT NULL DEFAULT 'promo',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news public read" ON public.news_posts;
DROP POLICY IF EXISTS "news admin all" ON public.news_posts;
CREATE POLICY "news public read" ON public.news_posts FOR SELECT USING (is_active = true OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "news admin all" ON public.news_posts FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS news_posts_updated_at ON public.news_posts;
CREATE TRIGGER news_posts_updated_at BEFORE UPDATE ON public.news_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.news_posts (slug, title, excerpt, content, kind, sort_order) VALUES
  ('birthday-15', '15% скидка в день рождения', '15% скидка в день рождения, 3 дня до и 3 дня после.', 'Подарите себе праздник: получите скидку 15% на любой заказ в день рождения, а также за 3 дня до и 3 дня после праздника. Достаточно сообщить оператору дату рождения — и скидка будет применена автоматически.', 'promo', 10),
  ('pickup-10', '10% скидка на самовывоз', '10% скидка на самовывоз при заказе с телефона или сайта.', 'Заберите заказ самостоятельно и получите скидку 10% на всё меню. Действует при оформлении заказа на сайте или по телефону.', 'promo', 20),
  ('wedding-15', '15% на годовщину свадьбы', '15% на годовщину свадьбы, 3 дня до и 3 дня после.', 'Празднуйте годовщину вкусно: 15% скидка на любой заказ в день годовщины свадьбы, а также за 3 дня до и 3 дня после.', 'promo', 30),
  ('every-1000-free', 'Каждый 1000 заказ в чеке БЕСПЛАТНО', 'Каждый 1000-й заказ — за наш счёт!', 'Каждый 1000-й оформленный заказ становится для гостя бесплатным. Следите за номерами заказов в личном кабинете.', 'promo', 40),
  ('loyalty', 'Копи баллы и оплачивай ими заказы', 'Бонусная программа КосмоСуши.', 'За каждый заказ начисляются бонусные баллы, которыми можно оплачивать до 50% от стоимости следующего заказа. Чем больше заказов — тем выше уровень и процент кешбэка.', 'promo', 50)
ON CONFLICT (slug) DO NOTHING;
