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
    const { supabase, userId } = context;

    // Только super_admin или admin филиала имеют доступ
    const { data: isSuper } = await (supabase.rpc as any)("has_role", { _user_id: userId, _role: "super_admin" });
    const { data: isAdmin } = await (supabase.rpc as any)("has_role", { _user_id: userId, _role: "admin" });
    if (!isSuper && !isAdmin) {
      throw new Error("Доступ запрещён");
    }
    // У branch-admin доступ только к своему филиалу
    const { data: canAccess } = await (supabase.rpc as any)("can_access_branch", {
      _user_id: userId,
      _branch_id: data.branchId,
    });
    if (!canAccess) {
      throw new Error("Нет доступа к филиалу");
    }

    // Чтение всех колонок через SECURITY DEFINER RPC (column-level security скрывает email при обычном select)
    const { data: branch, error } = await (supabase.rpc as any)("get_branch_full", { _id: data.branchId });
    if (error) throw new Error(error.message);
    const b = Array.isArray(branch) ? branch[0] : branch;
    if (!b) throw new Error("Филиал не найден");
    if (!b.email) throw new Error("У филиала не указан email");
    const branchName = b.name as string;
    const branchEmail = b.email as string;


    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY не настроен в секретах");
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222">
        <h2>✅ Тестовое письмо</h2>
        <p>Если вы видите это сообщение, значит уведомления о новых заказах для филиала
          <b>${branchName}</b> будут приходить на адрес <b>${branchEmail}</b>.</p>
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
        to: [branchEmail],
        subject: `Тестовое письмо · ${branchName}`,
        html,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Resend ${resp.status}: ${text}`);
    }

    return { ok: true, sentTo: branchEmail };
  });
