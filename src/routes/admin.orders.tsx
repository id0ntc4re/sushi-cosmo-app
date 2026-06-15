import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Modal } from "./admin.products";
import { printKitchenReceipt } from "@/lib/kitchen-print";
import { AddressFields } from "@/components/AddressFields";
import { FiscalReceiptModal } from "@/components/FiscalReceiptModal";
import { FiscalRefundModal } from "@/components/FiscalRefundModal";
import { DeliveryTimePicker } from "@/components/DeliveryTimePicker";

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
  const [editing, setEditing] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [customer, setCustomer] = useState<{ bonus_balance: number; total_spent: number; orders_count: number } | null>(null);
  const [fiscalOrderId, setFiscalOrderId] = useState<string | null>(null);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);

  async function load() {
    const q = supabase.from("orders").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
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

  useEffect(() => {
    if (editing && !products.length) {
      supabase.from("products").select("id,name,price,image_url,category_id,is_active")
        .eq("is_active", true).order("name").then(({ data }) => setProducts(data ?? []));
    }
  }, [editing]);

  async function loadHistory(orderId: string) {
    const { data } = await (supabase.from("order_changes") as any)
      .select("*").eq("order_id", orderId).order("created_at", { ascending: false });
    setHistory(data ?? []);
  }

  async function openOrder(o: Order) {
    setOpen(o); setEditing(false); setMeta(null); setShowHistory(false); setCustomer(null);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", o.id);
    setItems(data ?? []);
    loadHistory(o.id);
    if (o.user_id) {
      const { data: p } = await supabase.from("profiles").select("bonus_balance,total_spent").eq("id", o.user_id).maybeSingle();
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("user_id", o.user_id).is("deleted_at", null).neq("status", "cancelled");
      if (p) setCustomer({ bonus_balance: Number(p.bonus_balance) || 0, total_spent: Number(p.total_spent) || 0, orders_count: count ?? 0 });
    }
  }

  function startEdit() {
    setEditing(true);
    setMeta({
      customer_name: open.customer_name ?? "",
      phone: open.phone ?? "",
      delivery_type: open.delivery_type,
      address: open.address ?? "",
      pickup_point: open.pickup_point ?? "",
      delivery_time: open.delivery_time ?? "",
      payment_method: open.payment_method,
      change_from: open.change_from ?? "",
      persons: open.persons ?? 1,
      comment: open.comment ?? "",
      delivery_cost: Number(open.delivery_cost) || 0,
      discount: Number(open.discount) || 0,
    });
  }

  async function saveMeta() {
    if (!meta || !open) return;
    const payload: any = { ...meta, change_from: meta.change_from === "" ? null : Number(meta.change_from) };
    const { error } = await (supabase.from("orders") as any).update(payload).eq("id", open.id);
    if (error) return toast.error(error.message);
    await recalcOrderTotals(open.id);
    const { data: { user } } = await supabase.auth.getUser();

    // Считаем что именно изменилось, чтобы в истории было понятно
    const fieldLabels: Record<string, string> = {
      customer_name: "Имя клиента",
      phone: "Телефон",
      delivery_type: "Тип заказа",
      address: "Адрес",
      pickup_point: "Точка самовывоза",
      delivery_time: "Время",
      payment_method: "Способ оплаты",
      change_from: "Сдача с",
      persons: "Кол-во персон",
      comment: "Комментарий",
      delivery_cost: "Стоимость доставки",
      discount: "Скидка",
    };
    const fmt = (k: string, v: any) => {
      if (v === null || v === undefined || v === "") return "—";
      if (k === "delivery_type") return v === "delivery" ? "Доставка" : "Самовывоз";
      if (k === "payment_method") return v === "cash" ? "Наличные" : v === "card_courier" ? "Карта" : v === "card_online" ? "Онлайн" : String(v);
      return String(v);
    };
    const changes: Array<{ field: string; label: string; from: string; to: string }> = [];
    for (const k of Object.keys(fieldLabels)) {
      const oldV = (open as any)[k] ?? "";
      const newV = (payload as any)[k] ?? "";
      const a = oldV === null ? "" : String(oldV);
      const b = newV === null ? "" : String(newV);
      if (a !== b) changes.push({ field: k, label: fieldLabels[k], from: fmt(k, oldV), to: fmt(k, newV) });
    }

    await (supabase.from("order_changes") as any).insert({
      order_id: open.id, user_id: user?.id ?? null, action: "details_edited", details: { changes },
    });
    loadHistory(open.id);
    toast.success("Сохранено");
    const { data } = await supabase.from("orders").select("*").eq("id", open.id).maybeSingle();
    if (data) setOpen(data);
    load();
  }

  async function addProduct(p: any) {
    const { error } = await (supabase.from("order_items") as any).insert({
      order_id: open.id, product_id: p.id, name: p.name,
      price: p.price, quantity: 1, total: Number(p.price), modifiers: [],
    });
    if (error) return toast.error(error.message);
    await recalcOrderTotals(open.id);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", open.id);
    setItems(data ?? []);
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase.from("order_changes") as any).insert({
      order_id: open.id, user_id: user?.id ?? null, action: "item_added",
      details: { product_id: p.id, name: p.name, price: p.price },
    });
    loadHistory(open.id);
    toast.success(`+ ${p.name}`);
    load();
  }

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Статус обновлён");
    load();
    if (open?.id === id) setOpen({ ...open, status });
  }

  async function changeQty(it: any, q: number) {
    if (q <= 0) {
      if (!confirm(`Удалить «${it.name}»? Ингредиенты вернутся на склад.`)) return;
      const { error } = await supabase.from("order_items").delete().eq("id", it.id);
      if (error) return toast.error(error.message);
    } else {
      const total = Number(it.price) * q;
      const { error } = await (supabase.from("order_items") as any)
        .update({ quantity: q, total }).eq("id", it.id);
      if (error) return toast.error(error.message);
    }
    await recalcOrderTotals(open!.id);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", open!.id);
    setItems(data ?? []);
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase.from("order_changes") as any).insert({
      order_id: open!.id, user_id: user?.id ?? null,
      action: q <= 0 ? "item_removed" : "item_qty_changed",
      details: { item_id: it.id, name: it.name, from: it.quantity, to: q },
    });
    loadHistory(open!.id);
    load();
  }

  async function recalcOrderTotals(orderId: string) {
    const { data: its } = await supabase.from("order_items").select("total").eq("order_id", orderId);
    const subtotal = (its ?? []).reduce((a: number, x: any) => a + Number(x.total), 0);
    const { data: o } = await supabase.from("orders").select("delivery_cost,discount,bonus_used").eq("id", orderId).maybeSingle();
    const total = Math.max(0, subtotal + Number(o?.delivery_cost ?? 0) - Number(o?.discount ?? 0) - Number(o?.bonus_used ?? 0));
    await (supabase.from("orders") as any).update({ subtotal, total }).eq("id", orderId);
    if (open?.id === orderId) setOpen({ ...open, subtotal, total });
  }

  async function remove(id: string) {
    if (!confirm("Удалить заказ? Его можно будет восстановить из «Удалённых».")) return;
    const { error } = await supabase.from("orders").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Заказ перемещён в Удалённые");
    setOpen(null); load();
  }

  async function printKitchen(orderId: string) {
    try {
      await printKitchenReceipt(orderId);
      const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (data) setOpen(data);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось открыть печать");
    }
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
          {!editing ? (
            <div className="grid sm:grid-cols-2 gap-3 text-sm mb-5">
              <Info k="Клиент" v={open.customer_name} />
              <Info k="Телефон" v={<a href={`tel:${open.phone}`} className="text-primary">{open.phone}</a>} />
              <Info k="Тип" v={open.delivery_type === "delivery" ? "Доставка" : "Самовывоз"} />
              <Info k={open.delivery_type === "delivery" ? "Адрес" : "Точка"} v={open.address || open.pickup_point || "—"} />
              <Info k="Оплата" v={
                <select
                  value={open.payment_method as string}
                  onChange={async (e) => {
                    const method = e.target.value;
                    const prev = open.payment_method;
                    const { error } = await (supabase.from("orders") as any).update({ payment_method: method }).eq("id", open.id);
                    if (error) return toast.error(error.message);
                    const { data: { user } } = await supabase.auth.getUser();
                    await (supabase.from("order_changes") as any).insert({
                      order_id: open.id, user_id: user?.id ?? null, action: "payment_method_changed",
                      details: { from: prev, to: method },
                    });
                    setOpen({ ...open, payment_method: method });
                    loadHistory(open.id);
                    load();
                    toast.success("Способ оплаты изменён");
                  }}
                  className="font-semibold bg-transparent border-0 p-0 -ml-0.5 cursor-pointer focus:outline-none focus:ring-0 hover:text-primary">
                  <option value="cash">Наличные</option>
                  <option value="card_courier">Картой</option>
                  <option value="card_online">Онлайн</option>
                </select>
              } />
              {open.change_from && <Info k="Сдача с" v={`${open.change_from} ₽`} />}
              <Info k="Персон" v={open.persons} />
              <Info k="Время" v={formatDeliveryTime(open.delivery_time)} />
              {open.comment && <div className="sm:col-span-2"><Info k="Комментарий" v={open.comment} /></div>}
              {customer && (
                <div className="sm:col-span-2 flex flex-wrap gap-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                    🎁 Бонусов: {customer.bonus_balance}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 text-xs font-semibold">
                    Заказов: {customer.orders_count}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 text-xs font-semibold">
                    Потрачено: {customer.total_spent.toLocaleString("ru")} ₽
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-blue-50/50 rounded-2xl p-4 mb-5 space-y-3">
              <div className="font-bold text-sm mb-2">Данные заказа</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <L lab="Клиент"><input value={meta.customer_name} onChange={(e) => setMeta({ ...meta, customer_name: e.target.value })} className={inp} /></L>
                <L lab="Телефон"><input value={meta.phone} onChange={(e) => setMeta({ ...meta, phone: e.target.value })} className={inp} /></L>
                <L lab="Тип">
                  <select value={meta.delivery_type} onChange={(e) => setMeta({ ...meta, delivery_type: e.target.value })} className={inp}>
                    <option value="delivery">Доставка</option><option value="pickup">Самовывоз</option>
                  </select>
                </L>
                <L lab="Оплата">
                  <select value={meta.payment_method} onChange={(e) => setMeta({ ...meta, payment_method: e.target.value })} className={inp}>
                    <option value="cash">Наличные</option><option value="card_courier">Картой</option><option value="card_online">Онлайн</option>
                  </select>
                </L>
                {meta.delivery_type === "delivery" ? (
                  <L lab="Адрес" full><AddressFields value={meta.address} onChange={(v) => setMeta({ ...meta, address: v })} /></L>
                ) : (
                  <L lab="Точка самовывоза" full><input value={meta.pickup_point} onChange={(e) => setMeta({ ...meta, pickup_point: e.target.value })} className={inp} /></L>
                )}
                <L lab="Время"><input value={meta.delivery_time} onChange={(e) => setMeta({ ...meta, delivery_time: e.target.value })} className={inp} placeholder="ASAP или 19:30" /></L>
                <L lab="Персон"><input type="number" value={meta.persons} onChange={(e) => setMeta({ ...meta, persons: Number(e.target.value) })} className={inp} /></L>
                <L lab="Сдача с"><input type="number" value={meta.change_from} onChange={(e) => setMeta({ ...meta, change_from: e.target.value })} className={inp} /></L>
                <L lab="Доставка ₽"><input type="number" value={meta.delivery_cost} onChange={(e) => setMeta({ ...meta, delivery_cost: Number(e.target.value) })} className={inp} /></L>
                <L lab="Скидка ₽"><input type="number" value={meta.discount} onChange={(e) => setMeta({ ...meta, discount: Number(e.target.value) })} className={inp} /></L>
                <L lab="Комментарий" full><textarea value={meta.comment} onChange={(e) => setMeta({ ...meta, comment: e.target.value })} className={`${inp} min-h-[60px]`} /></L>
              </div>
              <button onClick={saveMeta} className="px-4 py-2 rounded-full bg-primary text-white font-semibold text-sm">💾 Сохранить данные</button>
            </div>
          )}

          <div className="flex gap-2 flex-wrap mb-4">
            {open.payment_status === "paid" ? (
              <span
                title={open.payment_method === "cash" ? "Оплачено наличными" : open.payment_method === "card_courier" ? "Оплачено картой" : open.payment_method === "card_online" ? "Оплачено онлайн" : ""}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                  open.payment_method === "cash"
                    ? "bg-emerald-100 text-emerald-700"
                    : open.payment_method === "card_courier"
                      ? "bg-sky-100 text-sky-700"
                      : "bg-violet-100 text-violet-700"
                }`}>
                <span className="text-sm">{open.payment_method === "cash" ? "💵" : open.payment_method === "card_courier" ? "💳" : "🌐"}</span>
                Оплачен{open.fiscal_receipt_number ? ` · чек ${open.fiscal_receipt_number}` : ""}
              </span>
            ) : (
              <span title="Не оплачено" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                <span className="text-sm">💵</span> Не оплачен
              </span>
            )}
            {open.kitchen_printed_at && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                🖨 Кухня печатался · {new Date(open.kitchen_printed_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {open.holiday_discount_kind && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-pink-100 text-pink-700">
                {open.holiday_discount_kind === "birthday" ? "🎂 Скидка ДР" : "💍 Скидка годовщина"}
              </span>
            )}
          </div>

          <div className="bg-neutral-50 rounded-2xl p-4 mb-5">
            <div className="flex justify-between items-center mb-3">
              <div className="font-bold">Товары</div>
              <button onClick={() => (editing ? setEditing(false) : startEdit())} className={`text-xs font-semibold px-3 py-1 rounded-full ${editing ? "bg-primary text-white" : "bg-white border"}`}>
                {editing ? "✓ Готово" : "✎ Редактировать"}
              </button>
            </div>
            {items.map((it) => (
              <div key={it.id} className="flex justify-between items-center py-1.5 text-sm gap-2">
                <span className="flex-1 truncate">{it.name}</span>
                {editing ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(it, it.quantity - 1)} className="h-7 w-7 rounded-full bg-white border font-bold">−</button>
                    <span className="w-6 text-center text-xs font-bold">{it.quantity}</span>
                    <button onClick={() => changeQty(it, it.quantity + 1)} className="h-7 w-7 rounded-full bg-primary text-white font-bold">+</button>
                    <button onClick={() => changeQty(it, 0)} className="ml-1 h-7 w-7 rounded-full bg-red-50 text-red-600 font-bold">✕</button>
                  </div>
                ) : (
                  <span className="text-neutral-500">× {it.quantity}</span>
                )}
                <span className="font-semibold w-20 text-right">{Number(it.total)} ₽</span>
              </div>
            ))}
            {editing && (
              <div className="mt-3 border-t pt-3">
                <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="🔍 Найти товар для добавления…"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm mb-2" />
                {productSearch && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-neutral-200 bg-white divide-y">
                    {products
                      .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                      .slice(0, 20)
                      .map((p) => (
                        <button key={p.id} onClick={() => addProduct(p)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary/5">
                          {p.image_url && <img src={p.image_url} className="h-8 w-8 rounded object-cover" alt="" />}
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="font-bold">{Number(p.price)} ₽</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
            <div className="border-t mt-3 pt-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-neutral-600">Товары</span><span>{Number(open.subtotal)} ₽</span></div>
              <div className="flex justify-between text-sm"><span className="text-neutral-600">Доставка</span><span>{Number(open.delivery_cost)} ₽</span></div>
              {Number(open.discount) > 0 && <div className="flex justify-between text-sm text-primary"><span>Скидка</span><span>−{Number(open.discount)} ₽</span></div>}
              {Number(open.bonus_used) > 0 && <div className="flex justify-between text-sm text-primary"><span>Бонусы</span><span>−{Number(open.bonus_used)} ₽</span></div>}
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

          <div className="bg-neutral-50 rounded-2xl p-4 mb-5">
            <button onClick={() => setShowHistory((v) => !v)} className="w-full flex justify-between items-center text-sm font-bold">
              <span>📜 История изменений {history.length > 0 && <span className="text-neutral-500 font-normal">· {history.length}</span>}</span>
              <span className="text-neutral-400">{showHistory ? "▲" : "▼"}</span>
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                {history.length === 0 && <div className="text-xs text-neutral-400 py-2">Изменений пока нет</div>}
                {history.map((h) => {
                  const titles: Record<string, string> = {
                    details_edited: "✎ Изменены данные заказа",
                    item_added: "➕ Добавлен товар",
                    item_removed: "🗑 Удалён товар",
                    item_qty_changed: "🔢 Изменено количество",
                    kitchen_printed: "🖨 Напечатан кухонный чек",
                    status_changed: "🔄 Изменён статус",
                    payment_method_changed: "💳 Изменён способ оплаты",
                    fiscal_printed: "🧾 Пробит фискальный чек",
                    fiscal_refunded: "↩ Оформлен возврат",
                  };
                  const payLabel = (m: string) =>
                    m === "cash" ? "Наличные" : m === "card_courier" ? "Карта" : m === "card_online" ? "Онлайн" : m;
                  const d = h.details || {};
                  return (
                    <div key={h.id} className="bg-white rounded-lg p-2.5 border border-neutral-200 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <div className="font-semibold">{titles[h.action] || h.action}</div>
                        <div className="text-neutral-400 whitespace-nowrap">{new Date(h.created_at).toLocaleString("ru")}</div>
                      </div>
                      {h.action === "item_added" && d.name && (
                        <div className="text-neutral-600 mt-1">Добавлен «{d.name}» по {Number(d.price)} ₽</div>
                      )}
                      {h.action === "item_removed" && d.name && (
                        <div className="text-neutral-600 mt-1">Удалён «{d.name}» (было {d.from} шт.)</div>
                      )}
                      {h.action === "item_qty_changed" && d.name && (
                        <div className="text-neutral-600 mt-1">«{d.name}»: {d.from} шт. → {d.to} шт.</div>
                      )}
                      {h.action === "payment_method_changed" && (
                        <div className="text-neutral-600 mt-1">{payLabel(d.from)} → {payLabel(d.to)}</div>
                      )}
                      {h.action === "details_edited" && Array.isArray(d.changes) && d.changes.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-neutral-600">
                          {d.changes.map((c: any, i: number) => (
                            <li key={i}><span className="font-semibold">{c.label}:</span> {c.from} → {c.to}</li>
                          ))}
                        </ul>
                      )}
                      {h.action === "details_edited" && (!Array.isArray(d.changes) || d.changes.length === 0) && (
                        <div className="text-neutral-500 mt-1 italic">Данные сохранены без изменений</div>
                      )}
                      {h.action === "fiscal_printed" && (
                        <div className="text-neutral-600 mt-1">
                          Оплата: {payLabel(d.payment_method)}
                          {d.fiscal_receipt_number && <> · чек №{d.fiscal_receipt_number}</>}
                          {d.fiscal_document_number && <> · ФД {d.fiscal_document_number}</>}
                        </div>
                      )}
                      {h.action === "fiscal_refunded" && (
                        <div className="text-neutral-600 mt-1">
                          Возврат на {Number(d.total || 0)} ₽ ({payLabel(d.payment_method)})
                          {d.fiscal_receipt_number && <> · чек №{d.fiscal_receipt_number}</>}
                          {Array.isArray(d.items) && d.items.length > 0 && (
                            <ul className="mt-0.5 pl-3 list-disc">
                              {d.items.map((it: any, i: number) => (
                                <li key={i}>{it.name} × {it.quantity}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between flex-wrap gap-2">
            <button onClick={() => remove(open.id)} className="px-4 py-2 rounded-full bg-red-50 text-red-600 font-semibold text-sm">Удалить</button>
            <div className="flex gap-2 flex-wrap">
              {open.fiscal_printed_at && (
                <button onClick={() => setRefundOrderId(open.id)}
                  className="px-4 py-2 rounded-full bg-rose-600 text-white font-semibold text-sm">
                  ↩ Возврат
                </button>
              )}
              <button onClick={() => setFiscalOrderId(open.id)}
                className="px-4 py-2 rounded-full bg-emerald-600 text-white font-semibold text-sm">
                🧾 {open.fiscal_printed_at ? "Перепробить чек" : "Пробить чек"}
              </button>
              <button onClick={() => printKitchen(open.id)}
                className="px-4 py-2 rounded-full bg-amber-500 text-white font-semibold text-sm">🖨 Кухонный чек</button>
              <button onClick={() => setOpen(null)} className="px-5 py-2 rounded-full bg-neutral-900 text-white font-semibold text-sm">Закрыть</button>
            </div>
          </div>
        </Modal>
      )}

      {fiscalOrderId && (
        <FiscalReceiptModal
          orderId={fiscalOrderId}
          onClose={() => setFiscalOrderId(null)}
          onPrinted={async () => {
            const { data } = await supabase.from("orders").select("*").eq("id", fiscalOrderId).maybeSingle();
            if (data && open?.id === fiscalOrderId) setOpen(data);
            load();
          }}
        />
      )}

      {refundOrderId && (
        <FiscalRefundModal
          orderId={refundOrderId}
          onClose={() => setRefundOrderId(null)}
          onRefunded={async () => { load(); }}
        />
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

const inp = "w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-sm";
function L({ lab, children, full }: any) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <div className="text-[11px] text-neutral-500 mb-0.5">{lab}</div>
      {children}
    </label>
  );
}
