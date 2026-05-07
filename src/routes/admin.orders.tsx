import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Modal } from "./admin.products";

export const Route = createFileRoute("/admin/orders")({
  component: OrdersAdmin,
});

const STATUSES = ["new", "confirmed", "cooking", "delivering", "done", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = {
  new: "Новый", confirmed: "Подтверждён", cooking: "Готовится",
  delivering: "Доставка", done: "Выполнен", cancelled: "Отменён",
};
const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  confirmed: "bg-purple-100 text-purple-700",
  cooking: "bg-amber-100 text-amber-700",
  delivering: "bg-cyan-100 text-cyan-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

type Order = any;

function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [open, setOpen] = useState<Order | null>(null);
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    const q = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    const { data } = await q;
    setOrders(data ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function openOrder(o: Order) {
    setOpen(o);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", o.id);
    setItems(data ?? []);
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Статус обновлён");
    load();
    if (open?.id === id) setOpen({ ...open, status });
  }

  async function remove(id: string) {
    if (!confirm("Удалить заказ?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setOpen(null); load();
  }

  const filtered = filter ? orders.filter((o) => o.status === filter) : orders;

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Заказы</h1>

      <div className="flex gap-2 mb-5 flex-wrap">
        <FilterPill active={!filter} onClick={() => setFilter("")} label={`Все (${orders.length})`} />
        {STATUSES.map((s) => {
          const n = orders.filter((o) => o.status === s).length;
          return <FilterPill key={s} active={filter === s} onClick={() => setFilter(s)} label={`${STATUS_LABEL[s]} (${n})`} />;
        })}
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr><th className="p-3">№</th><th>Клиент</th><th>Телефон</th><th>Тип</th><th>Сумма</th><th>Статус</th><th>Дата</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t hover:bg-neutral-50 cursor-pointer" onClick={() => openOrder(o)}>
                <td className="p-3 font-bold">#{o.number}</td>
                <td>{o.customer_name}</td>
                <td className="text-neutral-600">{o.phone}</td>
                <td className="text-xs">{o.delivery_type === "delivery" ? "🛵 Доставка" : "🏪 Самовывоз"}</td>
                <td className="font-bold">{Number(o.total)} ₽</td>
                <td><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                <td className="text-neutral-500 text-xs">{new Date(o.created_at).toLocaleString("ru")}</td>
                <td className="text-right pr-3">→</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={8} className="py-10 text-center text-neutral-400">Заказов нет</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal onClose={() => setOpen(null)} title={`Заказ #${open.number}`}>
          <div className="grid sm:grid-cols-2 gap-3 text-sm mb-5">
            <Info k="Клиент" v={open.customer_name} />
            <Info k="Телефон" v={<a href={`tel:${open.phone}`} className="text-primary">{open.phone}</a>} />
            <Info k="Тип" v={open.delivery_type === "delivery" ? "Доставка" : "Самовывоз"} />
            <Info k={open.delivery_type === "delivery" ? "Адрес" : "Точка"} v={open.address || open.pickup_point || "—"} />
            <Info k="Оплата" v={{ cash: "Наличные", card_courier: "Картой курьеру", card_online: "Онлайн" }[open.payment_method as string]} />
            {open.change_from && <Info k="Сдача с" v={`${open.change_from} ₽`} />}
            <Info k="Персон" v={open.persons} />
            <Info k="Время" v={open.delivery_time || "—"} />
            {open.comment && <div className="sm:col-span-2"><Info k="Комментарий" v={open.comment} /></div>}
          </div>

          <div className="bg-neutral-50 rounded-2xl p-4 mb-5">
            <div className="font-bold mb-3">Товары</div>
            {items.map((it) => (
              <div key={it.id} className="flex justify-between py-1.5 text-sm">
                <span>{it.name} <span className="text-neutral-500">× {it.quantity}</span></span>
                <span className="font-semibold">{Number(it.total)} ₽</span>
              </div>
            ))}
            <div className="border-t mt-3 pt-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-neutral-600">Товары</span><span>{Number(open.subtotal)} ₽</span></div>
              <div className="flex justify-between text-sm"><span className="text-neutral-600">Доставка</span><span>{Number(open.delivery_cost)} ₽</span></div>
              <div className="flex justify-between font-extrabold text-lg pt-1"><span>Итого</span><span>{Number(open.total)} ₽</span></div>
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xs text-neutral-600 mb-2">Изменить статус</div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setStatus(open.id, s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    open.status === s ? STATUS_COLOR[s] + " ring-2 ring-offset-1 ring-current" : "bg-neutral-100 hover:bg-neutral-200"
                  }`}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => remove(open.id)} className="px-4 py-2 rounded-full bg-red-50 text-red-600 font-semibold text-sm">Удалить</button>
            <button onClick={() => setOpen(null)} className="px-5 py-2 rounded-full bg-neutral-900 text-white font-semibold text-sm">Закрыть</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label }: any) {
  return <button onClick={onClick} className={`px-4 py-2 rounded-full text-sm font-semibold ${active ? "bg-primary text-white" : "bg-white hover:bg-neutral-100"}`}>{label}</button>;
}
function Info({ k, v }: any) {
  return <div><div className="text-xs text-neutral-500">{k}</div><div className="font-semibold">{v}</div></div>;
}
