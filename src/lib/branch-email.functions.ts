import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendTestBranchEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { branchId: string }) => {
    if (!input?.branchId || typeof input.branchId !== "string") {
      throw new Error("branchId обязателен");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: branch, error } = await supabase
      .from("branches")
      .select("id,name,email")
      .eq("id", data.branchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!branch) throw new Error("Филиал не найден");
    if (!branch.email) throw new Error("У филиала не указан email");

    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY не настроен в секретах");
    }

    await sendOrderEmail({
      to: [branch.email],
      order: {
        number: 9999,
        customer_name: "Тестовый клиент",
        phone: "+7 999 000-00-00",
        delivery_type: "delivery",
        address: "ул. Тестовая, 1, кв. 42",
        pickup_point: null,
        payment_method: "card_courier",
        change_from: null,
        delivery_time: "Как можно скорее",
        comment: "Это тестовое письмо — проверка доставки уведомлений о заказах.",
        subtotal: 1200,
        delivery_cost: 0,
        discount: 0,
        bonus_used: 0,
        total: 1200,
        branch_name: branch.name,
        items: [
          { name: "Филадельфия Классик", price: 590, quantity: 2 },
          { name: "Кола 0.5", price: 100, quantity: 1 },
        ],
      },
    });

    return { ok: true, sentTo: branch.email };
  });
