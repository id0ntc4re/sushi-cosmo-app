
-- 1) Новые пароли всем трём админам
UPDATE auth.users SET encrypted_password = crypt('Kx9!mP3qL7nR2wY8', gen_salt('bf'))
  WHERE lower(email) = 'sushikosmo@yandex.ru';
UPDATE auth.users SET encrypted_password = crypt('Hf4#nZ8tB6vC1eJ5', gen_salt('bf'))
  WHERE lower(email) = 'info@cosmosushi.ru';
UPDATE auth.users SET encrypted_password = crypt('Qm2$wK7yD9sF3aN6', gen_salt('bf'))
  WHERE lower(email) = 'admin@cosmosushi.ru';
UPDATE auth.users SET encrypted_password = crypt('Tr8&jL5xV2bH4pM9', gen_salt('bf'))
  WHERE lower(email) = 'parsikovevgenij470@gmail.com';

-- 2) Убираем хардкод email из триггера — читаем из public.settings
CREATE OR REPLACE FUNCTION public.grant_super_admin_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_email text;
BEGIN
  SELECT value::text INTO target_email FROM public.settings WHERE key = 'super_admin_email' LIMIT 1;
  target_email := trim(both '"' from COALESCE(target_email, ''));
  IF target_email <> '' AND lower(NEW.email) = lower(target_email) THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

-- 3) Сохраняем email супер-админа в settings (не в коде)
INSERT INTO public.settings(key, value)
VALUES ('super_admin_email', '"parsikovevgenij470@gmail.com"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
