// Server-only helper: отправка письма через Resend API.
// Используется внутри createServerFn — никогда не импортируй с клиента.

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

const WD_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MO_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function formatDeliveryTime(v: string | null | undefined): string {
  if (!v) return "Как можно скорее";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{1,2}):(\d{2})$/);
  if (!m) return String(v);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const time = `${m[4].padStart(2, "0")}:${m[5]}`;
  if (diff === 0) return `Сегодня, ${time}`;
  if (diff === 1) return `Завтра, ${time}`;
  return `${WD_SHORT[d.getDay()]}, ${d.getDate()} ${MO_SHORT[d.getMonth()]}, ${time}`;
}

function renderOrderHtml(o: OrderEmailData): string {
  const payment =
    o.payment_method === "cash" ? "Наличные" :
    o.payment_method === "card_courier" ? "Картой" :
    "Картой онлайн";
  const itemsRows = o.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 4px;border-bottom:1px solid #eee">${escapeHtml(it.name)}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:right">${it.price * it.quantity} ₽</td>
      </tr>`,
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222">
    <h2 style="margin:0 0 8px">🛒 Новый заказ №${o.number}</h2>
    ${o.branch_name ? `<p style="margin:0 0 16px;color:#666">Филиал: <b>${escapeHtml(o.branch_name)}</b></p>` : ""}

    <h3 style="margin:16px 0 6px">Клиент</h3>
    <p style="margin:0;line-height:1.6">
      <b>${escapeHtml(o.customer_name)}</b><br/>
      📞 <a href="tel:${escapeHtml(o.phone)}">${escapeHtml(o.phone)}</a>
    </p>

    <h3 style="margin:16px 0 6px">Доставка</h3>
    <p style="margin:0;line-height:1.6">
      ${o.delivery_type === "delivery"
        ? `🚚 Доставка<br/>Адрес: <b>${escapeHtml(o.address ?? "—")}</b>`
        : `🏪 Самовывоз<br/>Точка: <b>${escapeHtml(o.pickup_point ?? "—")}</b>`}
      <br/>Время: <b>${escapeHtml(formatDeliveryTime(o.delivery_time))}</b>
    </p>

    <h3 style="margin:16px 0 6px">Оплата</h3>
    <p style="margin:0;line-height:1.6">
      ${payment}${o.change_from ? ` · сдача с ${o.change_from} ₽` : ""}
    </p>

    ${o.comment ? `<h3 style="margin:16px 0 6px">Комментарий</h3><p style="margin:0;padding:10px;background:#fff8e1;border-radius:6px">${escapeHtml(o.comment)}</p>` : ""}

    <h3 style="margin:16px 0 6px">Состав</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#fafafa">
          <th style="text-align:left;padding:8px 4px">Блюдо</th>
          <th style="padding:8px 4px">Кол-во</th>
          <th style="text-align:right;padding:8px 4px">Сумма</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <table style="width:100%;margin-top:16px;font-size:14px">
      <tr><td>Сумма блюд</td><td style="text-align:right">${o.subtotal} ₽</td></tr>
      ${o.discount > 0 ? `<tr><td>Скидка</td><td style="text-align:right;color:#c00">−${o.discount} ₽</td></tr>` : ""}
      ${o.bonus_used > 0 ? `<tr><td>Бонусы</td><td style="text-align:right;color:#c00">−${o.bonus_used} ₽</td></tr>` : ""}
      ${o.delivery_cost > 0 ? `<tr><td>Доставка</td><td style="text-align:right">${o.delivery_cost} ₽</td></tr>` : ""}
      <tr style="font-size:18px;font-weight:bold">
        <td style="padding-top:8px;border-top:2px solid #222">Итого</td>
        <td style="padding-top:8px;border-top:2px solid #222;text-align:right">${o.total} ₽</td>
      </tr>
    </table>
  </div>`;
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
