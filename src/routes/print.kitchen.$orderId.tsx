import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/print/kitchen/$orderId")({ component: KitchenReceipt });

function KitchenReceipt() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [branch, setBranch] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!o) return;
      setOrder(o);
      const [{ data: it }, { data: br }] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", orderId),
        o.branch_id
          ? supabase.from("branches").select("*").eq("id", o.branch_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setItems(it ?? []);
      setBranch(br ?? null);

      // mark printed (first time)
      if (!o.kitchen_printed_at) {
        await (supabase.from("orders") as any)
          .update({ kitchen_printed_at: new Date().toISOString() })
          .eq("id", orderId);
        const { data: { user } } = await supabase.auth.getUser();
        await (supabase.from("order_changes") as any).insert({
          order_id: orderId,
          user_id: user?.id ?? null,
          action: "kitchen_printed",
          details: {},
        });
      }
      setTimeout(() => window.print(), 350);
    })();
  }, [orderId]);

  if (!order) return <div className="p-10">Загрузка…</div>;

  const created = new Date(order.created_at).toLocaleString("ru");

  return (
    <div className="bg-white text-black font-mono p-6 max-w-[80mm] mx-auto print:max-w-none print:p-2">
      <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } body { background: white; } .no-print { display: none } }`}</style>

      <div className="text-center">
        <div className="text-xl font-extrabold">КУХНЯ</div>
        <div className="text-3xl font-extrabold my-1">#{order.number}</div>
        {branch && <div className="text-sm">{branch.name}</div>}
        <div className="text-xs">{created}</div>
      </div>

      <div className="border-t border-dashed border-black my-3" />

      <div className="text-sm mb-2">
        <div><b>Тип:</b> {order.delivery_type === "delivery" ? "ДОСТАВКА" : "САМОВЫВОЗ"}</div>
        <div><b>Клиент:</b> {order.customer_name}</div>
        <div><b>Тел:</b> {order.phone}</div>
        {order.address && <div><b>Адрес:</b> {order.address}</div>}
        {order.delivery_time && <div><b>На время:</b> {order.delivery_time}</div>}
        {order.persons ? <div><b>Персон:</b> {order.persons}</div> : null}
      </div>

      <div className="border-t border-dashed border-black my-3" />

      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id}>
            <div className="flex justify-between font-bold text-base">
              <span className="uppercase">{it.name}</span>
              <span>× {it.quantity}</span>
            </div>
            {it.modifiers_summary && (
              <div className="text-xs pl-2">+ {it.modifiers_summary}</div>
            )}
          </div>
        ))}
      </div>

      {order.comment && (
        <>
          <div className="border-t border-dashed border-black my-3" />
          <div className="text-sm">
            <div className="font-bold">КОММЕНТАРИЙ:</div>
            <div>{order.comment}</div>
          </div>
        </>
      )}

      <div className="border-t border-dashed border-black my-3" />
      <div className="text-center text-xs">— конец заказа —</div>

      <div className="no-print mt-6 flex gap-2 justify-center">
        <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded font-bold">
          🖨 Печать
        </button>
        <button onClick={() => window.close()} className="px-4 py-2 bg-neutral-200 rounded">Закрыть</button>
      </div>
    </div>
  );
}
