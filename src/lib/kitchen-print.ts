import { supabase } from "@/integrations/supabase/client";

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReceiptHtml(order: any, items: any[], branch: any) {
  const created = new Date(order.created_at).toLocaleString("ru");
  const rows = items.map((it) => `
    <div class="item">
      <div class="item-main"><span>${esc(it.name).toUpperCase()}</span><b>× ${esc(it.quantity)}</b></div>
      ${it.modifiers_summary ? `<div class="mods">+ ${esc(it.modifiers_summary)}</div>` : ""}
    </div>
  `).join("");

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" /><title>Кухня #${esc(order.number)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #000; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .receipt { width: 80mm; max-width: 80mm; padding: 6mm; margin: 0 auto; }
  .center { text-align: center; } .title { font-size: 20px; font-weight: 900; } .num { font-size: 32px; font-weight: 900; margin: 3px 0; }
  .small { font-size: 12px; } .line { border-top: 1px dashed #000; margin: 10px 0; }
  .info { font-size: 14px; line-height: 1.35; } .items { display: grid; gap: 8px; }
  .item-main { display: flex; justify-content: space-between; gap: 10px; font-size: 16px; font-weight: 800; }
  .item-main span { overflow-wrap: anywhere; } .mods { font-size: 12px; padding-left: 8px; }
  .comment { font-size: 14px; } .comment b { display: block; margin-bottom: 2px; }
  .actions { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
  button { border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 800; cursor: pointer; }
  .print { background: #000; color: #fff; } .close { background: #eee; color: #000; }
  @media print { .actions { display: none; } .receipt { margin: 0; padding: 0; } }
</style></head><body>
  <main class="receipt">
    <section class="center"><div class="title">КУХНЯ</div><div class="num">#${esc(order.number)}</div>${branch?.name ? `<div class="small">${esc(branch.name)}</div>` : ""}<div class="small">${esc(created)}</div></section>
    <div class="line"></div>
    <section class="info">
      <div><b>Тип:</b> ${order.delivery_type === "delivery" ? "ДОСТАВКА" : "САМОВЫВОЗ"}</div>
      <div><b>Клиент:</b> ${esc(order.customer_name)}</div>
      <div><b>Тел:</b> ${esc(order.phone)}</div>
      ${order.address ? `<div><b>Адрес:</b> ${esc(order.address)}</div>` : ""}
      ${order.delivery_time ? `<div><b>На время:</b> ${esc(order.delivery_time)}</div>` : ""}
      ${order.persons ? `<div><b>Персон:</b> ${esc(order.persons)}</div>` : ""}
    </section>
    <div class="line"></div>
    <section class="items">${rows || `<div class="small center">Нет позиций</div>`}</section>
    ${order.comment ? `<div class="line"></div><section class="comment"><b>КОММЕНТАРИЙ:</b><div>${esc(order.comment)}</div></section>` : ""}
    <div class="line"></div><div class="center small">— конец заказа —</div>
    <div class="actions"><button class="print" onclick="window.print()">🖨 Печать</button><button class="close" onclick="window.close()">Закрыть</button></div>
  </main>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 250); });<\/script>
</body></html>`;
}

export async function printKitchenReceipt(orderId: string) {
  const { data: order, error: orderError } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Заказ не найден или нет доступа");

  const [{ data: items, error: itemsError }, { data: branch }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", orderId),
    order.branch_id ? supabase.from("branches").select("*").eq("id", order.branch_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (itemsError) throw new Error(itemsError.message);

  if (!order.kitchen_printed_at) {
    await (supabase.from("orders") as any).update({ kitchen_printed_at: new Date().toISOString() }).eq("id", orderId);
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase.from("order_changes") as any).insert({
      order_id: orderId,
      user_id: user?.id ?? null,
      action: "kitchen_printed",
      details: {},
    });
  }

  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) throw new Error("Браузер заблокировал окно печати. Разрешите всплывающие окна для сайта.");
  popup.document.open();
  popup.document.write(buildReceiptHtml(order, items ?? [], branch));
  popup.document.close();
}