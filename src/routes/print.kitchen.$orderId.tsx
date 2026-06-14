import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_RECEIPT, ReceiptSettings, loadReceiptSettings } from "@/lib/receipt-settings";

export const Route = createFileRoute("/print/kitchen/$orderId")({ component: KitchenReceipt });

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("ru");
const payLabel = (m: string) =>
  m === "cash" ? "Наличные" : m === "card" ? "Картой" : m === "online" ? "Онлайн" : m === "transfer" ? "Перевод" : m;

function KitchenReceipt() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [s, setS] = useState<ReceiptSettings>(DEFAULT_RECEIPT);
  const [bonus, setBonus] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: o, error: oe } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
        if (oe) { setError(oe.message); return; }
        if (!o) { setError("Заказ не найден или нет доступа."); return; }
        setOrder(o);
        const [{ data: it }, settings, profile] = await Promise.all([
          supabase.from("order_items").select("*").eq("order_id", orderId),
          loadReceiptSettings(o.branch_id),
          o.user_id
            ? supabase.from("profiles").select("bonus_balance").eq("id", o.user_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        setItems(it ?? []);
        setS(settings);
        setBonus(((profile?.data as any)?.bonus_balance) ?? null);

        if (!o.kitchen_printed_at) {
          await (supabase.from("orders") as any)
            .update({ kitchen_printed_at: new Date().toISOString() })
            .eq("id", orderId);
          const { data: { user } } = await supabase.auth.getUser();
          await (supabase.from("order_changes") as any).insert({
            order_id: orderId, user_id: user?.id ?? null, action: "kitchen_printed", details: {},
          });
        }
        setTimeout(() => { try { window.focus(); window.print(); } catch {} }, 600);
      } catch (e: any) { setError(e?.message ?? String(e)); }
    })();
  }, [orderId]);

  if (error) return <div className="p-10 text-red-600 font-mono whitespace-pre-wrap">{error}</div>;
  if (!order) return <div className="p-10">Загрузка…</div>;

  const created = new Date(order.created_at).toLocaleString("ru");
  const subtotal = Number(order.subtotal ?? items.reduce((a, b) => a + Number(b.total ?? Number(b.price ?? 0) * Number(b.quantity ?? 0)), 0));
  const discount = Number(order.discount ?? 0);
  const total = Number(order.total ?? subtotal - discount);

  return (
    <div className="bg-white text-black font-mono p-6 max-w-[80mm] mx-auto print:max-w-none print:p-2">
      <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } body { background: white; } .no-print { display: none } }`}</style>

      <div className="text-center">
        {s.logo_url && <img src={s.logo_url} alt="" className="mx-auto max-h-[22mm] object-contain mb-1" />}
        {s.name && <div className="text-xl font-extrabold">{s.name}</div>}
        {s.line1 && <div className="text-sm">{s.line1}</div>}
        {s.line2 && <div className="text-sm">{s.line2}</div>}
        {s.line3 && <div className="text-sm">{s.line3}</div>}
      </div>

      <div className="border-t border-dashed border-black my-2" />
      <div className="text-xs">{created}</div>
      <div className="text-2xl font-extrabold">## {order.number}</div>
      <div className="border-t border-dashed border-black my-2" />

      {s.show_items_table ? (
        <div className="text-sm">
          <div className="flex font-bold border-b border-dashed border-black pb-1 mb-1">
            <span className="flex-1">Наименование</span>
            <span className="w-8 text-right">Кол.</span>
            <span className="w-14 text-right">Сумма</span>
          </div>
          {items.map((it) => {
            const sum = Number(it.total ?? Number(it.price ?? 0) * Number(it.quantity ?? 0));
            return (
              <div key={it.id}>
                <div className="flex">
                  <span className="flex-1 uppercase">{it.name}</span>
                  <span className="w-8 text-right">{it.quantity}</span>
                  <span className="w-14 text-right">{fmt(sum)}</span>
                </div>
                {it.modifiers_summary && <div className="text-[11px] pl-2">+ {it.modifiers_summary}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id}>
              <div className="flex justify-between font-bold text-base">
                <span className="uppercase">{it.name}</span>
                <span>× {it.quantity}</span>
              </div>
              {it.modifiers_summary && <div className="text-xs pl-2">+ {it.modifiers_summary}</div>}
            </div>
          ))}
        </div>
      )}

      {s.show_totals && (
        <>
          <div className="border-t border-dashed border-black my-2" />
          <div className="flex justify-between text-sm"><b>ИТОГО</b><span>{fmt(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between text-sm"><span>Скидка</span><span>−{fmt(discount)}</span></div>}
          {order.delivery_cost ? <div className="flex justify-between text-sm"><span>Доставка</span><span>{fmt(Number(order.delivery_cost))}</span></div> : null}
          <div className="flex justify-between text-base font-extrabold border-t border-black mt-1 pt-1"><span>К ОПЛАТЕ</span><span>{fmt(total)}</span></div>
          {order.payment_method && <div className="text-xs">Оплата: {payLabel(order.payment_method)}</div>}
          {order.payment_method === "cash" && s.show_change && Number(order.change_from ?? 0) > 0 && (
            <div className="text-sm font-bold mt-1">
              Купюра: {fmt(Number(order.change_from))}, Сдача: {fmt(Math.max(0, Number(order.change_from) - total))}
            </div>
          )}
        </>
      )}

      {s.footer && <div className="text-center text-sm whitespace-pre-wrap my-2">{s.footer}</div>}

      {s.show_customer && (
        <>
          <div className="border-t border-dashed border-black my-2" />
          <div className="text-sm leading-relaxed">
            <div><b>Тип:</b> {order.delivery_type === "delivery" ? "ДОСТАВКА" : "САМОВЫВОЗ"}</div>
            <div><b>Клиент:</b> {order.customer_name}</div>
            <div><b>Телефон:</b> {order.phone}</div>
            {order.address && <div><b>Адрес:</b> {order.address}</div>}
            {order.delivery_time && <div><b>На время:</b> {order.delivery_time}</div>}
            {order.persons ? <div><b>Персон:</b> {order.persons}</div> : null}
            {s.show_bonus && bonus !== null && (
              <div><b>Баллы:</b> {bonus}
                {order.bonus_used ? `, списано: ${order.bonus_used}` : ""}
                {order.bonus_earned ? `, начислено: ${order.bonus_earned}` : ""}
              </div>
            )}
            {order.comment && <div><b>Примечание:</b> {order.comment}</div>}
          </div>
        </>
      )}

      <div className="border-t border-dashed border-black my-2" />
      <div className="text-center text-xs">— конец заказа —</div>

      <div className="no-print mt-6 flex gap-2 justify-center">
        <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded font-bold">🖨 Печать</button>
        <button onClick={() => window.close()} className="px-4 py-2 bg-neutral-200 rounded">Закрыть</button>
      </div>
    </div>
  );
}
