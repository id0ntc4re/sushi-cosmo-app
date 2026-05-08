import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { validatePromo, type PromoCode } from "@/lib/promo";
import { getDeliverySlots } from "@/lib/timeSlots";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Оформление заказа — КосмоСуши" }] }),
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

type Settings = {
  delivery_cost: number;
  free_delivery_from: number;
  min_order: number;
};
const DEFAULT_SETTINGS: Settings = {
  delivery_cost: 150,
  free_delivery_from: 1000,
  min_order: 0,
};

type Addon = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  weight: string | null;
};

function Checkout() {
  const cart = useCart();
  const { items, subtotal, clear, add, setQty } = cart;
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; discount: number; promo: PromoCode } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [bonusUse, setBonusUse] = useState(0);

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

  useEffect(() => {
    (async () => {
      const [{ data: st }, { data: ad }] = await Promise.all([
        supabase.from("settings").select("value").eq("key", "general").maybeSingle(),
        supabase.from("products").select("id,name,price,image_url,weight").eq("is_active", true).eq("in_stock", true).eq("is_addon", true).order("sort_order"),
      ]);
      if (st?.value) setSettings({ ...DEFAULT_SETTINGS, ...(st.value as any) });
      setAddons((ad as Addon[]) ?? []);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [{ data: prof }, { data: addrs }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
        ]);
        setProfile(prof);
        setSavedAddresses(addrs ?? []);
        setForm((f) => ({
          ...f,
          customer_name: f.customer_name || prof?.full_name || "",
          phone: f.phone || prof?.phone || "",
          address: f.address || addrs?.find((a: any) => a.is_default)?.address || "",
        }));
      }
    })();
  }, []);

  // re-validate promo when subtotal changes
  useEffect(() => {
    if (!promo) return;
    if (subtotal < Number(promo.promo.min_order)) {
      setPromo(null);
      setPromoErr(`Минимальная сумма для промокода: ${promo.promo.min_order} ₽`);
    }
  }, [subtotal, promo]);

  const deliveryCost =
    form.delivery_type === "delivery"
      ? subtotal >= settings.free_delivery_from
        ? 0
        : settings.delivery_cost
      : 0;
  const discount = promo?.discount ?? 0;
  const tier = profile ? (Number(profile.total_spent) >= 30000 ? "gold" : Number(profile.total_spent) >= 10000 ? "silver" : "bronze") : null;
  const tierDiscount = tier === "gold" ? Math.round(subtotal * 0.07) : tier === "silver" ? Math.round(subtotal * 0.03) : 0;
  const cashbackPct = tier === "gold" ? 10 : tier === "silver" ? 5 : 3;
  const bonusBalance = Math.floor(Number(profile?.bonus_balance || 0));
  const maxBonus = Math.min(bonusBalance, Math.floor(subtotal * 0.3));
  const bonusApplied = Math.min(bonusUse, maxBonus);
  const total = Math.max(0, subtotal - discount - tierDiscount - bonusApplied + deliveryCost);
  const bonusEarn = profile ? Math.floor((subtotal - bonusApplied) * cashbackPct / 100) : 0;
  const belowMin = settings.min_order > 0 && subtotal < settings.min_order;

  async function applyPromo() {
    setPromoErr(null);
    const res = await validatePromo(promoInput, subtotal);
    if (!res.ok) {
      setPromoErr(res.error);
      setPromo(null);
      return;
    }
    setPromo({ code: res.promo.code, discount: res.discount, promo: res.promo });
    toast.success(`Промокод применён: −${res.discount} ₽`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (items.length === 0) return setError("Корзина пуста");
    if (belowMin) return setError(`Минимальная сумма заказа: ${settings.min_order} ₽`);

    const parsed = schema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (parsed.data.delivery_type === "delivery" && !parsed.data.address)
      return setError("Укажите адрес доставки");

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUserId = sessionData.session?.user?.id ?? null;
      const totalDiscount = discount + tierDiscount;
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: sessionUserId,
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
          discount: totalDiscount,
          promo_code: promo?.code ?? null,
          bonus_used: bonusApplied,
          bonus_earned: bonusEarn,
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

      if (promo) {
        await supabase
          .from("promo_codes")
          .update({ used_count: promo.promo.used_count + 1 })
          .eq("id", promo.promo.id);
      }

      // bonuses & total spent
      if (sessionUserId && profile) {
        const newBalance = bonusBalance - bonusApplied + bonusEarn;
        const newSpent = Number(profile.total_spent || 0) + total;
        await supabase.from("profiles").update({ bonus_balance: newBalance, total_spent: newSpent }).eq("id", sessionUserId);
        if (bonusApplied > 0) {
          await supabase.from("bonus_transactions").insert({ user_id: sessionUserId, order_id: order.id, amount: -bonusApplied, reason: `Списание · заказ №${order.number}` });
        }
        if (bonusEarn > 0) {
          await supabase.from("bonus_transactions").insert({ user_id: sessionUserId, order_id: order.id, amount: bonusEarn, reason: `Кэшбэк · заказ №${order.number}` });
        }
      }

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
        <h1 className="text-3xl md:text-4xl font-extrabold mb-6">Оформление заказа</h1>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          <StepDot n={1} active={step === 1} done={step > 1} label="Дополнительно" />
          <div className="h-px flex-1 bg-neutral-200 max-w-[80px]" />
          <StepDot n={2} active={step === 2} done={false} label="Контакты и доставка" />
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          <div className="bg-white rounded-3xl p-6 md:p-8 space-y-6">
            {step === 1 ? (
              <>
                <div>
                  <h2 className="text-xl font-extrabold mb-1">Не забудьте добавить</h2>
                  <p className="text-sm text-neutral-500 mb-5">Соусы, имбирь и палочки — всё для идеального ужина</p>

                  {addons.length === 0 ? (
                    <div className="py-8 text-center text-neutral-400 text-sm">Допы не настроены</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {addons.map((a) => {
                        const inCart = items.find((i) => i.id === a.id);
                        return (
                          <div key={a.id} className="rounded-2xl border border-neutral-100 p-3 flex flex-col">
                            <div className="aspect-square rounded-xl bg-neutral-50 grid place-items-center overflow-hidden text-3xl mb-2">
                              {a.image_url ? <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" /> : "🥢"}
                            </div>
                            <div className="text-sm font-semibold line-clamp-2 leading-snug min-h-[2.4em]">{a.name}</div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="font-extrabold">{Number(a.price)} ₽</span>
                              {inCart ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setQty(a.id, inCart.quantity - 1)} className="h-7 w-7 rounded-full bg-neutral-100 font-bold">−</button>
                                  <span className="w-5 text-center text-sm font-bold">{inCart.quantity}</span>
                                  <button onClick={() => setQty(a.id, inCart.quantity + 1)} className="h-7 w-7 rounded-full bg-primary text-white font-bold">+</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => add({ id: a.id, name: a.name, price: Number(a.price), image_url: a.image_url, weight: a.weight })}
                                  className="h-7 w-7 rounded-full bg-primary text-white font-bold"
                                >+</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-8 py-3.5 rounded-full bg-primary text-white font-bold hover:opacity-90"
                  >
                    Далее →
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={submit} className="space-y-6">
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
                    <>
                      {savedAddresses.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {savedAddresses.map((a) => (
                            <button key={a.id} type="button" onClick={() => set("address", a.address)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${form.address === a.address ? "border-primary bg-primary/5 text-primary" : "border-neutral-200 hover:border-neutral-400"}`}>
                              {a.label ? `${a.label}: ` : ""}{a.address}
                            </button>
                          ))}
                        </div>
                      )}
                      <Field label="Адрес доставки*">
                        <input className={inputCls} value={form.address}
                          onChange={(e) => set("address", e.target.value)}
                          placeholder="Улица, дом, кв., подъезд, этаж" required />
                      </Field>
                    </>
                  ) : (
                    <Field label="Точка самовывоза">
                      <select className={inputCls} value={form.pickup_point}
                        onChange={(e) => set("pickup_point", e.target.value)}>
                        {PICKUP_POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </Field>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Время доставки">
                      <select className={inputCls} value={form.delivery_time}
                        onChange={(e) => set("delivery_time", e.target.value)}>
                        <option value="">Как можно скорее</option>
                        {getDeliverySlots().map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
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

                {belowMin && (
                  <div className="px-4 py-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
                    Минимальная сумма заказа: <b>{settings.min_order} ₽</b>. Добавьте ещё на {settings.min_order - subtotal} ₽.
                  </div>
                )}
                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="px-6 py-4 rounded-full bg-neutral-100 font-bold hover:bg-neutral-200">
                    ← Назад
                  </button>
                  <button type="submit" disabled={submitting || items.length === 0 || belowMin}
                    className="flex-1 py-4 rounded-full bg-primary text-white font-bold text-lg hover:opacity-90 disabled:opacity-50 transition">
                    {submitting ? "Отправляем…" : `Оформить заказ — ${total} ₽`}
                  </button>
                </div>
              </form>
            )}
          </div>

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

                {/* Promo */}
                <div className="border-t pt-4 mb-3">
                  {promo ? (
                    <div className="flex items-center justify-between bg-green-50 text-green-700 rounded-xl px-3 py-2 text-sm">
                      <span>🏷️ <b>{promo.code}</b> применён</span>
                      <button onClick={() => { setPromo(null); setPromoInput(""); }} className="text-xs hover:underline">Убрать</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoErr(null); }}
                          placeholder="Промокод"
                          className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 focus:border-primary outline-none text-sm uppercase"
                        />
                        <button type="button" onClick={applyPromo}
                          className="px-4 rounded-xl bg-neutral-900 text-white text-sm font-semibold">Применить</button>
                      </div>
                      {promoErr && <div className="text-xs text-red-600 mt-1.5">{promoErr}</div>}
                    </>
                  )}
                </div>

                {profile && bonusBalance > 0 && (
                  <div className="border-t pt-4 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold">⭐ Бонусы ({bonusBalance} ₽)</span>
                      <span className="text-xs text-neutral-500">Макс. {maxBonus} ₽</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input type="range" min={0} max={maxBonus} value={bonusApplied}
                        onChange={(e) => setBonusUse(Number(e.target.value))} className="flex-1" />
                      <input type="number" min={0} max={maxBonus} value={bonusApplied}
                        onChange={(e) => setBonusUse(Math.max(0, Math.min(maxBonus, Number(e.target.value) || 0)))}
                        className="w-20 px-2 py-1 rounded-lg border text-sm text-right" />
                    </div>
                  </div>
                )}

                <div className="space-y-1 text-sm border-t pt-4">
                  <Row k="Товары" v={`${subtotal} ₽`} />
                  {discount > 0 && <Row k={`Промо ${promo?.code ?? ""}`} v={`−${discount} ₽`} accent />}
                  {tierDiscount > 0 && <Row k="Скидка уровня" v={`−${tierDiscount} ₽`} accent />}
                  {bonusApplied > 0 && <Row k="Бонусы" v={`−${bonusApplied} ₽`} accent />}
                  <Row k="Доставка" v={deliveryCost === 0 ? "Бесплатно" : `${deliveryCost} ₽`} />
                </div>
                <div className="flex justify-between mt-4 pt-4 border-t">
                  <span className="font-bold">Итого</span>
                  <span className="text-2xl font-extrabold">{total} ₽</span>
                </div>
                {bonusEarn > 0 && (
                  <div className="text-xs text-amber-700 mt-2 text-center">+{bonusEarn} ₽ бонусов после заказа</div>
                )}
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
function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-600">{k}</span>
      <span className={`font-semibold ${accent ? "text-green-600" : ""}`}>{v}</span>
    </div>
  );
}
function StepDot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${
        done ? "bg-green-500 text-white" : active ? "bg-primary text-white" : "bg-neutral-200 text-neutral-500"
      }`}>{done ? "✓" : n}</span>
      <span className={`font-semibold ${active ? "text-foreground" : "text-neutral-500"}`}>{label}</span>
    </div>
  );
}
