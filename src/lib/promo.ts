import { supabase } from "@/integrations/supabase/client";

export type PromoCode = {
  id: string;
  code: string;
  discount_type: string; // 'percent' | 'fixed'
  discount_value: number;
  min_order: number;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
};

export async function validatePromo(code: string, subtotal: number): Promise<
  { ok: true; discount: number; promo: PromoCode } | { ok: false; error: string }
> {
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false, error: "Введите промокод" };

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .ilike("code", c)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Промокод не найден" };

  const now = new Date();
  if (data.starts_at && new Date(data.starts_at) > now)
    return { ok: false, error: "Промокод ещё не активен" };
  if (data.expires_at && new Date(data.expires_at) < now)
    return { ok: false, error: "Срок действия истёк" };
  if (data.max_uses != null && data.used_count >= data.max_uses)
    return { ok: false, error: "Промокод исчерпан" };
  if (Number(data.min_order) > subtotal)
    return {
      ok: false,
      error: `Минимальная сумма для промокода: ${data.min_order} ₽`,
    };

  const value = Number(data.discount_value);
  const discount =
    data.discount_type === "percent"
      ? Math.round((subtotal * value) / 100)
      : Math.min(value, subtotal);

  return { ok: true, discount, promo: data as PromoCode };
}
