
CREATE OR REPLACE FUNCTION public.loyalty_tier(_total numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _total >= 30000 THEN 'gold'
    WHEN _total >= 10000 THEN 'silver'
    ELSE 'bronze'
  END
$$;
