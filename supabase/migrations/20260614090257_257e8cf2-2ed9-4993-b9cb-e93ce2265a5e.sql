
-- 1) Branches: column-level grants — anon/authenticated видят только безопасные поля
REVOKE SELECT ON public.branches FROM anon;
REVOKE SELECT ON public.branches FROM authenticated;
GRANT SELECT (id, name, address, phone, is_active, sort_order, created_at) ON public.branches TO anon;
GRANT SELECT (id, name, address, phone, is_active, sort_order, created_at) ON public.branches TO authenticated;
GRANT SELECT ON public.branches TO service_role;
-- admins/branch staff редактируют через INSERT/UPDATE/DELETE — гранты на эти операции остаются
-- (authenticated уже имеет INSERT/UPDATE/DELETE из общего блока)

-- 2) RPC: вернуть полную строку филиала, если у сотрудника есть к нему доступ
CREATE OR REPLACE FUNCTION public.get_branch_full(_id uuid)
RETURNS public.branches
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.* FROM public.branches b
  WHERE b.id = _id
    AND public.can_access_branch(auth.uid(), _id);
$$;
REVOKE ALL ON FUNCTION public.get_branch_full(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_branch_full(uuid) TO authenticated;

-- 3) RPC: список филиалов с полными колонками — только для админов
CREATE OR REPLACE FUNCTION public.list_branches_full()
RETURNS SETOF public.branches
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.branches
  WHERE public.has_role(auth.uid(), 'super_admin')
     OR public.has_role(auth.uid(), 'admin')
  ORDER BY sort_order;
$$;
REVOKE ALL ON FUNCTION public.list_branches_full() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_branches_full() TO authenticated;

-- 4) Promo codes: убираем публичное чтение неперсональных промокодов
DROP POLICY IF EXISTS "promo public read active" ON public.promo_codes;
CREATE POLICY "promo own read"
ON public.promo_codes FOR SELECT TO authenticated
USING (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- 5) RPC validate_promo — безопасная проверка промокода без раскрытия всей таблицы
CREATE OR REPLACE FUNCTION public.validate_promo(_code text, _subtotal numeric)
RETURNS TABLE(
  id uuid, code text, discount_type text, discount_value numeric, min_order numeric,
  starts_at timestamptz, expires_at timestamptz, max_uses int, used_count int,
  gift_product_id uuid, gift_product_name text, gift_product_image_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.promo_codes p
   WHERE upper(p.code) = upper(trim(_code))
     AND p.is_active = true
     AND (p.user_id IS NULL OR p.user_id = auth.uid())
   LIMIT 1;

  IF r IS NULL THEN RETURN; END IF;
  IF r.starts_at IS NOT NULL AND r.starts_at > now() THEN RETURN; END IF;
  IF r.expires_at IS NOT NULL AND r.expires_at < now() THEN RETURN; END IF;
  IF r.max_uses IS NOT NULL AND r.used_count >= r.max_uses THEN RETURN; END IF;
  IF COALESCE(r.min_order, 0) > COALESCE(_subtotal, 0) THEN RETURN; END IF;

  id := r.id; code := r.code; discount_type := r.discount_type;
  discount_value := r.discount_value; min_order := r.min_order;
  starts_at := r.starts_at; expires_at := r.expires_at;
  max_uses := r.max_uses; used_count := r.used_count;
  gift_product_id := r.gift_product_id; gift_product_name := r.gift_product_name;
  gift_product_image_url := r.gift_product_image_url;
  RETURN NEXT;
END
$$;
REVOKE ALL ON FUNCTION public.validate_promo(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_promo(text, numeric) TO anon, authenticated;

-- 6) Атомарное увеличение счётчика использований промокода с проверкой лимита
CREATE OR REPLACE FUNCTION public.bump_promo_usage(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated_rows int;
BEGIN
  UPDATE public.promo_codes
     SET used_count = used_count + 1
   WHERE id = _id
     AND is_active = true
     AND (max_uses IS NULL OR used_count < max_uses)
     AND (starts_at IS NULL OR starts_at <= now())
     AND (expires_at IS NULL OR expires_at >= now());
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END
$$;
REVOKE ALL ON FUNCTION public.bump_promo_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_promo_usage(uuid) TO service_role;
