CREATE OR REPLACE FUNCTION public.issue_vk_welcome_promo()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  tries int := 0;
BEGIN
  LOOP
    new_code := 'VK' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    BEGIN
      INSERT INTO public.promo_codes(code, discount_type, discount_value, min_order, expires_at, max_uses, is_active)
      VALUES (new_code, 'percent', 10, 0, now() + interval '30 days', 1, true);
      RETURN new_code;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 5 THEN RAISE; END IF;
    END;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.issue_vk_welcome_promo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_vk_welcome_promo() TO anon, authenticated;