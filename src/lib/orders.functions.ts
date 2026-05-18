import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOrderEmail } from "@/lib/email.server";

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
      branch_id: z.string().uuid().nullable(),
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

    let branchId = data.order.branch_id;
    if (!branchId) {
      const { data: br } = await supabaseAdmin
        .from("branches").select("id").eq("is_active", true)
        .order("sort_order").limit(1).maybeSingle();
      branchId = br?.id ?? null;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({ ...data.order, user_id: userId, branch_id: branchId })
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
// ===== Admin POS: create order on behalf of customer =====
export const createOrderAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    customer_user_id: z.string().uuid().nullable(),
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
      branch_id: z.string().uuid().nullable(),
      admin_note: z.string().max(500).nullable(),
    }),
    items: z.array(z.object({
      product_id: z.string().uuid().nullable(),
      name: z.string().min(1).max(200),
      price: z.number().min(0),
      quantity: z.number().int().min(1).max(99),
    })).min(1),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Verify caller is admin or super_admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role,branch_id").eq("user_id", userId);
    const list = (roles ?? []) as { role: string; branch_id: string | null }[];
    const isSuper = list.some((r) => r.role === "super_admin");
    const adminRow = list.find((r) => r.role === "admin");
    if (!isSuper && !adminRow) throw new Error("Доступ запрещён");

    // Branch: super can pick any; branch admin forced to their branch
    const branchId = isSuper
      ? data.order.branch_id
      : adminRow?.branch_id ?? null;

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        ...data.order,
        branch_id: branchId,
        user_id: data.customer_user_id,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .select("id, number")
      .single();
    if (error || !order) throw new Error(error?.message ?? "Не удалось создать заказ");

    const { error: itemsErr } = await supabaseAdmin.from("order_items").insert(
      data.items.map((it) => ({
        order_id: order.id,
        product_id: it.product_id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        total: it.quantity * it.price,
      })),
    );
    if (itemsErr) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(itemsErr.message);
    }

    // Bonus accounting if linked to a customer
    if (data.customer_user_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("bonus_balance,total_spent")
        .eq("id", data.customer_user_id).maybeSingle();
      if (profile) {
        const newBalance = Number(profile.bonus_balance || 0) - data.order.bonus_used + data.order.bonus_earned;
        const newSpent = Number(profile.total_spent || 0) + data.order.total;
        await supabaseAdmin.from("profiles")
          .update({ bonus_balance: newBalance, total_spent: newSpent })
          .eq("id", data.customer_user_id);
        if (data.order.bonus_used > 0) {
          await supabaseAdmin.from("bonus_transactions").insert({
            user_id: data.customer_user_id, order_id: order.id,
            amount: -data.order.bonus_used,
            reason: `Списание · заказ №${order.number}`,
          });
        }
        if (data.order.bonus_earned > 0) {
          await supabaseAdmin.from("bonus_transactions").insert({
            user_id: data.customer_user_id, order_id: order.id,
            amount: data.order.bonus_earned,
            reason: `Кэшбэк · заказ №${order.number}`,
          });
        }
      }
    }

    return order;
  });
