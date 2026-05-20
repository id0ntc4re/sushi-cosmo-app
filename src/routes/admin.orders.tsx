import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Modal } from "./admin.products";
import { printKitchenReceipt } from "@/lib/kitchen-print";

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
    setOpen(o); setEditing(false); setMeta(null); setShowHistory(false);
    const { data } = await supabase.from("order_items").select("*").eq("order_id", o.id);
    setItems(data ?? []);
    loadHistory(o.id);
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
    await (supabase.from("order_changes") as any).insert({
      order_id: open.id, user_id: user?.id ?? null, action: "details_edited", details: payload,
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
              <Info k="Оплата" v={{ cash: "Наличные", card_courier: "Картой курьеру", card_online: "Онлайн" }[open.payment_method as string]} />
              {open.change_from && <Info k="Сдача с" v={`${open.change_from} ₽`} />}
              <Info k="Персон" v={open.persons} />
              <Info k="Время" v={open.delivery_time || "—"} />
              {open.comment && <div className="sm:col-span-2"><Info k="Комментарий" v={open.comment} /></div>}
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
                    <option value="cash">Наличные</option><option value="card_courier">Картой курьеру</option><option value="card_online">Онлайн</option>
                  </select>
                </L>
                {meta.delivery_type === "delivery" ? (
                  <L lab="Адрес" full><input value={meta.address} onChange={(e) => setMeta({ ...meta, address: e.target.value })} className={inp} /></L>
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
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${open.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {open.payment_status === "paid" ? `💰 Оплачен${open.fiscal_receipt_number ? ` · чек ${open.fiscal_receipt_number}` : ""}` : "💵 Не оплачен"}
            </span>
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

          <div className="flex justify-between flex-wrap gap-2">
            <button onClick={() => remove(open.id)} className="px-4 py-2 rounded-full bg-red-50 text-red-600 font-semibold text-sm">Удалить</button>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => printKitchen(open.id)}
                className="px-4 py-2 rounded-full bg-amber-500 text-white font-semibold text-sm">🖨 Кухонный чек</button>
              <button onClick={() => setOpen(null)} className="px-5 py-2 rounded-full bg-neutral-900 text-white font-semibold text-sm">Закрыть</button>
            </div>
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

const inp = "w-full px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-sm";
function L({ lab, children, full }: any) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <div className="text-[11px] text-neutral-500 mb-0.5">{lab}</div>
      {children}
    </label>
  );
}
