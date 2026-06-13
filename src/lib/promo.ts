import { supabase } from "@/integrations/supabase/client";

export type PromoCode = {
  id: string;
  code: string;
  discount_type: string; // 'percent' | 'fixed' | 'gift'
  discount_value: number;
  min_order: number;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  gift_product_id: string | null;
  gift_product_name: string | null;
  gift_product_image_url: string | null;
};

export type GiftItem = {
  product_id: string | null;
  name: string;
  image_url: string | null;
};

export async function validatePromo(code: string, subtotal: number): Promise<
  { ok: true; discount: number; gift: GiftItem | null; promo: PromoCode } | { ok: false; error: string }
> {
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false, error: "Введите промокод" };

  const { data, error } = await (supabase
    .from("promo_codes") as any)
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

  let discount = 0;
  let gift: GiftItem | null = null;

  if (data.discount_type === "gift") {
    // Resolve gift product info — prefer linked product, fallback to custom fields
    if (data.gift_product_id) {
      const { data: prod } = await supabase
        .from("products")
        .select("id,name,image_url")
        .eq("id", data.gift_product_id)
        .maybeSingle();
      if (prod) {
        gift = { product_id: prod.id, name: prod.name, image_url: prod.image_url };
      }
    }
    if (!gift) {
      const name = (data.gift_product_name ?? "").trim();
      if (!name) return { ok: false, error: "Подарочный товар не настроен" };
      gift = { product_id: null, name, image_url: data.gift_product_image_url ?? null };
    }
  } else {
    const value = Number(data.discount_value);
    discount =
      data.discount_type === "percent"
        ? Math.round((subtotal * value) / 100)
        : Math.min(value, subtotal);
  }

  return { ok: true, discount, gift, promo: data as PromoCode };
}
