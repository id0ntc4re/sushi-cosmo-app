// Server-only helper: отправка письма через Resend API.
// Используется внутри createServerFn — никогда не импортируй с клиента.
import { formatDeliveryTime } from "./datetime";



type OrderItem = { name: string; price: number; quantity: number };
type OrderEmailData = {
  number: number;
  customer_name: string;
  phone: string;
  delivery_type: "delivery" | "pickup";
  address: string | null;
  pickup_point: string | null;
  payment_method: string;
  change_from: number | null;
  delivery_time: string | null;
  comment: string | null;
  subtotal: number;
  delivery_cost: number;
  discount: number;
  bonus_used: number;
  total: number;
  branch_name: string | null;
  items: OrderItem[];
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}




function renderOrderHtml(o: OrderEmailData): string {
  const payment =
    o.payment_method === "cash" ? "Наличные" :
    o.payment_method === "card_courier" ? "Картой курьеру" :
    "Картой онлайн";

  const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
  const orderNo = `#${String(o.number).padStart(4, "0")}`;
  const now = new Date();
  const createdAt =
    `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()} ` +
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const itemsRows = o.items
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px">${escapeHtml(it.name)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;text-align:center;width:60px">${it.quantity}</td>
        <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;text-align:right;width:100px;white-space:nowrap">${fmtMoney(it.price * it.quantity)}</td>
      </tr>`,
    )
    .join("");

  const totalsRow = (label: string, val: string, color = "#6b7280") => `
      <tr>
        <td style="padding:4px 0;color:${color};font-size:14px">${label}:</td>
        <td style="padding:4px 0;color:${color};font-size:14px;text-align:right;white-space:nowrap">${val}</td>
      </tr>`;

  const deliveryBlock = o.delivery_type === "delivery"
    ? `<div style="color:#111827;font-weight:500;font-style:italic;font-size:14px">Курьером на адрес:</div>
       <div style="color:#1f2937;margin-top:4px;font-size:14px;line-height:1.5">${escapeHtml(o.address ?? "—")}</div>`
    : `<div style="color:#111827;font-weight:500;font-style:italic;font-size:14px">Самовывоз:</div>
       <div style="color:#1f2937;margin-top:4px;font-size:14px;line-height:1.5">${escapeHtml(o.pickup_point ?? "—")}</div>`;

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Новый заказ ${orderNo}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:40px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

      <tr><td style="background:#18181b;padding:24px 32px;border-bottom:4px solid #f97316">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle">
            <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">КОСМО<span style="color:#f97316">СУШИ</span></div>
            <div style="color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-top:4px">Новый заказ в филиале</div>
          </td>
          <td style="vertical-align:middle;text-align:right">
            <div style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Номер заказа</div>
            <div style="color:#ffffff;font-size:20px;font-weight:700;font-family:'SF Mono',Menlo,Consolas,monospace;margin-top:2px">${orderNo}</div>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="background:#fafafa;padding:20px 32px;border-bottom:1px solid #f3f4f6">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:top">
            <div style="color:#9ca3af;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:4px">Филиал</div>
            <div style="color:#1f2937;font-weight:500;font-size:14px">${escapeHtml(o.branch_name ?? "—")}</div>
          </td>
          <td style="vertical-align:top;text-align:right">
            <div style="color:#9ca3af;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:4px">Принят</div>
            <div style="color:#1f2937;font-weight:500;font-size:14px">${createdAt}</div>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:24px 32px;border-bottom:1px solid #f3f4f6">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="50%" style="vertical-align:top;padding-right:16px">
            <div style="color:#9ca3af;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:10px">Клиент</div>
            <div style="color:#111827;font-weight:700;font-size:17px">${escapeHtml(o.customer_name)}</div>
            <a href="tel:${escapeHtml(o.phone)}" style="color:#ea580c;text-decoration:none;font-weight:500;display:block;margin-top:4px;font-size:14px">${escapeHtml(o.phone)}</a>
            <div style="margin-top:14px">
              <div style="color:#9ca3af;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:2px">Время</div>
              <div style="color:#1f2937;font-size:14px">${escapeHtml(formatDeliveryTime(o.delivery_time))}</div>
            </div>
          </td>
          <td width="50%" style="vertical-align:top;padding-left:16px">
            <div style="color:#9ca3af;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:10px">Доставка</div>
            ${deliveryBlock}
            <div style="margin-top:14px">
              <div style="color:#9ca3af;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:2px">Оплата</div>
              <div style="color:#1f2937;font-size:14px">${payment}${o.change_from ? ` <span style="color:#6b7280">· сдача с ${fmtMoney(o.change_from)}</span>` : ""}</div>
            </div>
          </td>
        </tr></table>
      </td></tr>

      ${o.comment ? `
      <tr><td style="background:#fff7ed;padding:14px 32px;border-left:4px solid #fb923c">
        <div style="color:#9a3412;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:4px">Комментарий к заказу</div>
        <div style="color:#7c2d12;font-size:14px;line-height:1.5;font-style:italic">«${escapeHtml(o.comment)}»</div>
      </td></tr>` : ""}

      <tr><td style="padding:24px 32px">
        <div style="color:#9ca3af;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:12px">Состав заказа</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <thead><tr>
            <th align="left" style="padding:8px 0;border-bottom:2px solid #e5e7eb;color:#1f2937;font-size:13px;font-weight:700">Наименование</th>
            <th align="center" style="padding:8px 0;border-bottom:2px solid #e5e7eb;color:#1f2937;font-size:13px;font-weight:700;width:60px">Кол-во</th>
            <th align="right" style="padding:8px 0;border-bottom:2px solid #e5e7eb;color:#1f2937;font-size:13px;font-weight:700;width:100px">Цена</th>
          </tr></thead>
          <tbody>${itemsRows}</tbody>
        </table>
      </td></tr>

      <tr><td style="background:#fafafa;padding:24px 32px;border-top:1px solid #e5e7eb">
        <table role="presentation" align="right" cellpadding="0" cellspacing="0" border="0" style="width:240px">
          ${totalsRow("Сумма блюд", fmtMoney(o.subtotal))}
          ${o.discount > 0 ? totalsRow("Скидка", `−${fmtMoney(o.discount)}`, "#16a34a") : ""}
          ${o.bonus_used > 0 ? totalsRow("Бонусы", `−${fmtMoney(o.bonus_used)}`, "#2563eb") : ""}
          ${o.delivery_cost > 0 ? totalsRow("Доставка", fmtMoney(o.delivery_cost)) : totalsRow("Доставка", "Бесплатно")}
          <tr><td colspan="2" style="padding-top:8px"><div style="border-top:1px solid #e5e7eb;line-height:0;font-size:0">&nbsp;</div></td></tr>
          <tr>
            <td style="padding:8px 0;color:#111827;font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Итого:</td>
            <td style="padding:8px 0;color:#ea580c;font-size:20px;font-weight:700;text-align:right;white-space:nowrap">${fmtMoney(o.total)}</td>
          </tr>
        </table>
        <div style="clear:both;height:0;line-height:0;font-size:0">&nbsp;</div>
      </td></tr>

      <tr><td style="padding:24px 32px;text-align:center;border-top:1px solid #f3f4f6">
        <div style="color:#9ca3af;font-size:11px;line-height:1.6">
          Это автоматическое уведомление для сотрудников филиала КосмоСуши.<br/>
          При возникновении проблем свяжитесь с администратором.
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/**
 * Отправляет копию заказа на список email-адресов.
 * Никогда не бросает исключение наружу — ошибка только логируется,
 * чтобы не валить оформление заказа.
 */
export async function sendOrderEmail(opts: {
  to: string[];
  order: OrderEmailData;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY не настроен — письмо не отправлено");
    return;
  }
  const recipients = Array.from(new Set(opts.to.filter((x) => x && x.includes("@"))));
  if (recipients.length === 0) return;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "КосмоСуши <onboarding@resend.dev>",
        to: recipients,
        subject: `Новый заказ №${opts.order.number} · ${opts.order.total} ₽`,
        html: renderOrderHtml(opts.order),
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[email] Resend ${resp.status}: ${text}`);
    }
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}
