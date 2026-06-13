import { supabase } from "@/integrations/supabase/client";
import { loadReceiptSettings, ReceiptSettings } from "@/lib/receipt-settings";

type ReceiptOrder = {
  id: string;
  number: number | string;
  created_at: string;
  delivery_type: string;
  customer_name: string;
  phone: string;
  address?: string | null;
  delivery_time?: string | null;
  persons?: number | string | null;
  comment?: string | null;
  branch_id?: string | null;
  kitchen_printed_at?: string | null;
  subtotal?: number | null;
  discount?: number | null;
  delivery_cost?: number | null;
  total?: number | null;
  bonus_used?: number | null;
  bonus_earned?: number | null;
  payment_method?: string | null;
  user_id?: string | null;
};

type ReceiptItem = {
  id?: string;
  name: string;
  quantity: number | string;
  price?: number | null;
  total?: number | null;
  modifiers_summary?: string | null;
};

type UpdatableTable = {
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => Promise<unknown>;
  };
};

type InsertableTable = {
  insert: (values: Record<string, unknown>) => Promise<unknown>;
};

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("ru");

function buildReceiptHtml(
  order: ReceiptOrder,
  items: ReceiptItem[],
  s: ReceiptSettings,
  bonusBalance: number | null,
) {
  const created = new Date(order.created_at).toLocaleString("ru");
  const subtotal = Number(order.subtotal ?? items.reduce((a, b) => a + Number(b.total ?? Number(b.price ?? 0) * Number(b.quantity ?? 0)), 0));
  const discount = Number(order.discount ?? 0);
  const total = Number(order.total ?? subtotal - discount);

  const itemsRows = s.show_items_table
    ? `
    <div class="row head"><span class="name">Наименование</span><span class="qty">Кол.</span><span class="sum">Сумма</span></div>
    ${items
      .map((it) => {
        const lineSum = Number(it.total ?? Number(it.price ?? 0) * Number(it.quantity ?? 0));
        return `
        <div class="row"><span class="name">${esc(it.name).toUpperCase()}</span><span class="qty">${esc(it.quantity)}</span><span class="sum">${fmt(lineSum)}</span></div>
        ${it.modifiers_summary ? `<div class="mods">+ ${esc(it.modifiers_summary)}</div>` : ""}
      `;
      })
      .join("")}
    `
    : items
        .map(
          (it) => `
      <div class="row big"><span class="name">${esc(it.name).toUpperCase()}</span><span class="sum">× ${esc(it.quantity)}</span></div>
      ${it.modifiers_summary ? `<div class="mods">+ ${esc(it.modifiers_summary)}</div>` : ""}
    `,
        )
        .join("");

  const totalsBlock = s.show_totals
    ? `
    <div class="line"></div>
    <div class="row"><b class="name">ИТОГО</b><span class="sum">${fmt(subtotal)}</span></div>
    ${discount > 0 ? `<div class="row"><span class="name">Скидка</span><span class="sum">−${fmt(discount)}</span></div>` : ""}
    ${order.delivery_cost ? `<div class="row"><span class="name">Доставка</span><span class="sum">${fmt(Number(order.delivery_cost))}</span></div>` : ""}
    <div class="row pay"><b class="name">К ОПЛАТЕ</b><b class="sum">${fmt(total)}</b></div>
    ${order.payment_method ? `<div class="small">Оплата: ${esc(payMethodLabel(order.payment_method))}</div>` : ""}
  `
    : "";

  const customerBlock = s.show_customer
    ? `
    <div class="line"></div>
    <div class="info">
      <div><b>Тип:</b> ${order.delivery_type === "delivery" ? "ДОСТАВКА" : "САМОВЫВОЗ"}</div>
      <div><b>Клиент:</b> ${esc(order.customer_name)}</div>
      <div><b>Телефон:</b> ${esc(order.phone)}</div>
      ${order.address ? `<div><b>Адрес:</b> ${esc(order.address)}</div>` : ""}
      ${order.delivery_time ? `<div><b>На время:</b> ${esc(order.delivery_time)}</div>` : ""}
      ${order.persons ? `<div><b>Персон:</b> ${esc(order.persons)}</div>` : ""}
      ${s.show_bonus && bonusBalance !== null ? `<div><b>Баллы:</b> ${bonusBalance}${order.bonus_used ? `, списано: ${order.bonus_used}` : ""}${order.bonus_earned ? `, начислено: ${order.bonus_earned}` : ""}</div>` : ""}
      ${order.comment ? `<div><b>Примечание:</b> ${esc(order.comment)}</div>` : ""}
    </div>
  `
    : "";

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" /><title>Кухня #${esc(order.number)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #000; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .receipt { width: 80mm; max-width: 80mm; padding: 6mm; margin: 0 auto; }
  .center { text-align: center; }
  .logo { max-width: 60mm; max-height: 22mm; object-fit: contain; margin: 0 auto 4px; display: block; }
  .title { font-size: 22px; font-weight: 900; }
  .header-line { font-size: 13px; }
  .num { font-size: 28px; font-weight: 900; margin: 3px 0; }
  .small { font-size: 12px; }
  .line { border-top: 1px dashed #000; margin: 8px 0; }
  .info { font-size: 13px; line-height: 1.4; }
  .info b { font-weight: 700; }
  .row { display: flex; font-size: 13px; gap: 6px; }
  .row.head { font-weight: 800; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 2px; }
  .row.big { font-size: 16px; font-weight: 800; }
  .row.pay { font-size: 16px; margin-top: 2px; border-top: 1px solid #000; padding-top: 3px; }
  .row .name { flex: 1; overflow-wrap: anywhere; }
  .row .qty { width: 28px; text-align: right; }
  .row .sum { width: 60px; text-align: right; }
  .mods { font-size: 11px; padding-left: 8px; margin-bottom: 2px; }
  .footer-msg { text-align: center; font-size: 13px; margin: 8px 0; white-space: pre-wrap; }
  .actions { display: flex; justify-content: center; gap: 8px; margin-top: 16px; }
  button { border: 0; border-radius: 8px; padding: 10px 14px; font-weight: 800; cursor: pointer; }
  .print { background: #000; color: #fff; } .close { background: #eee; color: #000; }
  @media print { .actions { display: none; } .receipt { margin: 0; padding: 0; } }
</style></head><body>
  <main class="receipt">
    <section class="center">
      ${s.logo_url ? `<img class="logo" src="${esc(s.logo_url)}" alt="" />` : ""}
      ${s.name ? `<div class="title">${esc(s.name)}</div>` : ""}
      ${s.line1 ? `<div class="header-line">${esc(s.line1)}</div>` : ""}
      ${s.line2 ? `<div class="header-line">${esc(s.line2)}</div>` : ""}
      ${s.line3 ? `<div class="header-line">${esc(s.line3)}</div>` : ""}
    </section>
    <div class="line"></div>
    <div class="small">${esc(created)}</div>
    <div class="num">## ${esc(order.number)}</div>
    <div class="line"></div>
    <section>${itemsRows || `<div class="small center">Нет позиций</div>`}</section>
    ${totalsBlock}
    ${s.footer ? `<div class="footer-msg">${esc(s.footer)}</div>` : ""}
    ${customerBlock}
    <div class="line"></div>
    <div class="center small">— конец заказа —</div>
    <div class="actions"><button class="print" onclick="window.print()">🖨 Печать</button><button class="close" onclick="window.close()">Закрыть</button></div>
  </main>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 350); });</script>
</body></html>`;
}

function payMethodLabel(m: string) {
  switch (m) {
    case "cash": return "Наличные";
    case "card": return "Картой";
    case "online": return "Онлайн";
    case "transfer": return "Перевод";
    default: return m;
  }
}

export async function printKitchenReceipt(orderId: string) {
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) {
    throw new Error("Браузер заблокировал окно печати. Разрешите всплывающие окна для сайта.");
  }
  popup.document.write("<div style='font:16px monospace;padding:24px'>Готовим кухонный чек…</div>");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Заказ не найден или нет доступа");

  const [{ data: items, error: itemsError }, settings, bonus] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", orderId),
    loadReceiptSettings(order.branch_id),
    order.user_id
      ? supabase.from("profiles").select("bonus_balance").eq("id", order.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (itemsError) throw new Error(itemsError.message);

  if (!order.kitchen_printed_at) {
    await (supabase.from("orders") as unknown as UpdatableTable)
      .update({ kitchen_printed_at: new Date().toISOString() })
      .eq("id", orderId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await (supabase.from("order_changes") as unknown as InsertableTable).insert({
      order_id: orderId,
      user_id: user?.id ?? null,
      action: "kitchen_printed",
      details: {},
    });
  }

  popup.document.open();
  popup.document.write(buildReceiptHtml(order, items ?? [], settings, (bonus?.data as any)?.bonus_balance ?? null));
  popup.document.close();
}
