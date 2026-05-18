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

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222">
        <h2>✅ Тестовое письмо</h2>
        <p>Если вы видите это сообщение, значит уведомления о новых заказах для филиала
          <b>${branch.name}</b> будут приходить на адрес <b>${branch.email}</b>.</p>
        <p style="color:#666;font-size:13px">Отправлено из админки сайта КосмоСуши.</p>
      </div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "КосмоСуши <onboarding@resend.dev>",
        to: [branch.email],
        subject: `Тестовое письмо · ${branch.name}`,
        html,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Resend ${resp.status}: ${text}`);
    }

    return { ok: true, sentTo: branch.email };
  });
