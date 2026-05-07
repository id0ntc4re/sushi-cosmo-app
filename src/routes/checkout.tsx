import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Оформление заказа — КосмоСуши" }],
  }),
  component: Checkout,
});

const schema = z.object({
  customer_name: z.string().trim().min(2, "Укажите имя").max(100),
  phone: z.string().trim().min(10, "Укажите телефон").max(20),
  delivery_type: z.enum(["delivery", "pickup"]),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  pickup_point: z.string().trim().max(200).optional().or(z.literal("")),
  payment_method: z.enum(["cash", "card_courier", "card_online"]),
  change_from: z.string().optional(),
  persons: z.coerce.number().int().min(1).max(20),
  delivery_time: z.string().max(50).optional().or(z.literal("")),
  comment: z.string().max(500).optional().or(z.literal("")),
});

const PICKUP_POINTS = ["пр-т Шахтёров, 68", "Бр Строителей, 21"];

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    delivery_type: "delivery" as "delivery" | "pickup",
    address: "",
    pickup_point: PICKUP_POINTS[0],
    payment_method: "cash" as "cash" | "card_courier" | "card_online",
    change_from: "",
    persons: 1,
    delivery_time: "",
    comment: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const deliveryCost = form.delivery_type === "delivery" ? (subtotal >= 1000 ? 0 : 150) : 0;
  const total = subtotal + deliveryCost;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (items.length === 0) {
      setError("Корзина пуста");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (parsed.data.delivery_type === "delivery" && !parsed.data.address) {
      setError("Укажите адрес доставки");
      return;
    }

    setSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user.user?.id ?? null,
          customer_name: parsed.data.customer_name,
          phone: parsed.data.phone,
          delivery_type: parsed.data.delivery_type,
          address: parsed.data.delivery_type === "delivery" ? parsed.data.address : null,
          pickup_point: parsed.data.delivery_type === "pickup" ? parsed.data.pickup_point : null,
          payment_method: parsed.data.payment_method,
          change_from: parsed.data.change_from ? Number(parsed.data.change_from) : null,
          persons: parsed.data.persons,
          delivery_time: parsed.data.delivery_time || null,
          comment: parsed.data.comment || null,
          subtotal,
          delivery_cost: deliveryCost,
          total,
        })
        .select("id, number")
        .single();
      if (orderErr || !order) throw orderErr ?? new Error("order error");

      const { error: itemsErr } = await supabase.from("order_items").insert(
        items.map((it) => ({
          order_id: order.id,
          product_id: it.id,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          total: it.quantity * Number(it.price),
        })),
      );
      if (itemsErr) throw itemsErr;

      clear();
      nav({ to: "/order-success", search: { n: order.number } });
    } catch (err: any) {
      setError(err?.message ?? "Не удалось оформить заказ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b">
        <div className="mx-auto max-w-[1280px] px-6 h-20 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-10 w-10" />
            <span className="font-extrabold text-xl">КосмоСуши</span>
          </Link>
          <Link to="/" className="ml-auto text-sm text-neutral-600 hover:text-primary">
            ← Вернуться в меню
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-8">Оформление заказа</h1>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          <form onSubmit={submit} className="bg-white rounded-3xl p-6 md:p-8 space-y-6">
            <Section title="Контактные данные">
              <Field label="Имя*">
                <input className={inputCls} value={form.customer_name}
                  onChange={(e) => set("customer_name", e.target.value)} required />
              </Field>
              <Field label="Телефон*">
                <input type="tel" className={inputCls} value={form.phone}
                  onChange={(e) => set("phone", e.target.value)} placeholder="+7 ___ ___ __ __" required />
              </Field>
            </Section>

            <Section title="Способ получения">
              <div className="grid grid-cols-2 gap-2">
                {(["delivery", "pickup"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => set("delivery_type", t)}
                    className={`py-3 rounded-xl font-semibold border-2 transition ${
                      form.delivery_type === t
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-neutral-200 text-neutral-700 hover:border-neutral-300"
                    }`}>
                    {t === "delivery" ? "Доставка" : "Самовывоз"}
                  </button>
                ))}
              </div>

              {form.delivery_type === "delivery" ? (
                <Field label="Адрес доставки*">
                  <input className={inputCls} value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="Улица, дом, кв., подъезд, этаж" required />
                </Field>
              ) : (
                <Field label="Точка самовывоза">
                  <select className={inputCls} value={form.pickup_point}
                    onChange={(e) => set("pickup_point", e.target.value)}>
                    {PICKUP_POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Время">
                  <input className={inputCls} value={form.delivery_time}
                    onChange={(e) => set("delivery_time", e.target.value)}
                    placeholder="Как можно скорее" />
                </Field>
                <Field label="Персон">
                  <input type="number" min={1} max={20} className={inputCls} value={form.persons}
                    onChange={(e) => set("persons", Number(e.target.value))} />
                </Field>
              </div>
            </Section>

            <Section title="Оплата">
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["cash", "Наличные"],
                  ["card_courier", "Картой курьеру"],
                  ["card_online", "Онлайн"],
                ] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => set("payment_method", v)}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition ${
                      form.payment_method === v
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-neutral-200 text-neutral-700 hover:border-neutral-300"
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
              {form.payment_method === "cash" && (
                <Field label="Сдача с (₽)">
                  <input type="number" className={inputCls} value={form.change_from}
                    onChange={(e) => set("change_from", e.target.value)}
                    placeholder="Например, 2000" />
                </Field>
              )}
            </Section>

            <Section title="Комментарий">
              <textarea className={`${inputCls} min-h-[90px]`} value={form.comment}
                onChange={(e) => set("comment", e.target.value)}
                placeholder="Пожелания к заказу" />
            </Section>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
            )}

            <button type="submit" disabled={submitting || items.length === 0}
              className="w-full py-4 rounded-full bg-primary text-white font-bold text-lg hover:opacity-90 disabled:opacity-50 transition">
              {submitting ? "Отправляем…" : `Оформить заказ — ${total} ₽`}
            </button>
          </form>

          <aside className="bg-white rounded-3xl p-6 h-fit lg:sticky lg:top-6">
            <h3 className="font-extrabold text-lg mb-4">Ваш заказ</h3>
            {items.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-sm">
                Корзина пуста.<br />
                <Link to="/" className="text-primary font-semibold">Перейти в меню</Link>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-5 max-h-[40vh] overflow-y-auto">
                  {items.map((it) => (
                    <div key={it.id} className="flex justify-between gap-3 text-sm">
                      <div className="flex-1">
                        <div className="font-medium line-clamp-2">{it.name}</div>
                        <div className="text-neutral-500 text-xs">{it.quantity} × {Number(it.price)} ₽</div>
                      </div>
                      <div className="font-semibold whitespace-nowrap">
                        {it.quantity * Number(it.price)} ₽
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-sm border-t pt-4">
                  <Row k="Товары" v={`${subtotal} ₽`} />
                  <Row k="Доставка" v={deliveryCost === 0 ? "Бесплатно" : `${deliveryCost} ₽`} />
                </div>
                <div className="flex justify-between mt-4 pt-4 border-t">
                  <span className="font-bold">Итого</span>
                  <span className="text-2xl font-extrabold">{total} ₽</span>
                </div>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition bg-white";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-bold text-lg">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-neutral-600 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-600">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
