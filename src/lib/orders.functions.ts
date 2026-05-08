import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    accessToken: z.string().nullable().optional(),
    order: z.object({
      customer_name: z.string().trim().min(2).max(100),
      phone: z.string().trim().min(10).max(20),
      delivery_type: z.enum(["delivery", "pickup"]),
      address: z.string().max(300).nullable(),
      pickup_point: z.string().max(200).nullable(),
      payment_method: z.enum(["cash", "card_courier", "card_online"]),
      change_from: z.number().nullable(),
      persons: z.number().int().min(1).max(20),
      delivery_time: z.string().max(50).nullable(),
      comment: z.string().max(500).nullable(),
      subtotal: z.number().min(0),
      delivery_cost: z.number().min(0),
      discount: z.number().min(0),
      promo_code: z.string().nullable(),
      bonus_used: z.number().min(0),
      bonus_earned: z.number().min(0),
      total: z.number().min(0),
    }),
    items: z.array(z.object({
      product_id: z.string().uuid().nullable(),
      name: z.string().min(1).max(200),
      price: z.number().min(0),
      quantity: z.number().int().min(1).max(99),
    })).min(1),
    promo: z.object({
      id: z.string().uuid(),
      used_count: z.number().int().min(0),
    }).nullable(),
  }).parse(data))
  .handler(async ({ data }) => {
    let userId: string | null = null;

    if (data.accessToken) {
      const { data: userData } = await supabaseAdmin.auth.getUser(data.accessToken);
      userId = userData.user?.id ?? null;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({ ...data.order, user_id: userId })
      .select("id, number")
      .single();

    if (orderError || !order) throw new Error(orderError?.message ?? "Не удалось создать заказ");

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
      data.items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.quantity * item.price,
      })),
    );

    if (itemsError) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(itemsError.message);
    }

    if (data.promo) {
      await supabaseAdmin
        .from("promo_codes")
        .update({ used_count: data.promo.used_count + 1 })
        .eq("id", data.promo.id);
    }

    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("bonus_balance,total_spent")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        const newBalance = Number(profile.bonus_balance || 0) - data.order.bonus_used + data.order.bonus_earned;
        const newSpent = Number(profile.total_spent || 0) + data.order.total;
        await supabaseAdmin.from("profiles").update({ bonus_balance: newBalance, total_spent: newSpent }).eq("id", userId);

        if (data.order.bonus_used > 0) {
          await supabaseAdmin.from("bonus_transactions").insert({
            user_id: userId,
            order_id: order.id,
            amount: -data.order.bonus_used,
            reason: `Списание · заказ №${order.number}`,
          });
        }

        if (data.order.bonus_earned > 0) {
          await supabaseAdmin.from("bonus_transactions").insert({
            user_id: userId,
            order_id: order.id,
            amount: data.order.bonus_earned,
            reason: `Кэшбэк · заказ №${order.number}`,
          });
        }
      }
    }

    return order;
  });