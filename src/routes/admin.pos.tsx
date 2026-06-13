import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminRole } from "@/lib/admin-role";
import { createOrderAsAdmin } from "@/lib/orders.functions";
import { formatRuPhone } from "@/lib/phone-format";

export const Route = createFileRoute("/admin/pos")({ component: PosPage });

type Product = { id: string; name: string; price: number; image_url: string | null; category_id: string | null; is_addon: boolean };
type Category = { id: string; name: string; sort_order: number };
type CartLine = { product_id: string | null; name: string; price: number; quantity: number };
type Profile = { id: string; full_name: string | null; phone: string | null; email: string | null; bonus_balance: number; total_spent: number; birth_date: string | null; anniversary_date: string | null };
type RecentOrder = { id: string; number: number; total: number; created_at: string; address: string | null; delivery_type: string; phone: string };

function PosPage() {
  const { isSuper, branchId, branches, loading } = useAdminRole();
  const submit = useServerFn(createOrderAsAdmin);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [searching, setSearching] = useState(false);

  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card_courier" | "card_online">("cash");
  const [discountPct, setDiscountPct] = useState(0);
  const [bonusUse, setBonusUse] = useState(0);
  const [posBranch, setPosBranch] = useState<string>("");
  const [adminNote, setAdminNote] = useState("");
  const [holidayKind, setHolidayKind] = useState<"birthday" | "anniversary" | null>(null);
  const [busy, setBusy] = useState(false);

  function daysToNext(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const today = new Date();
    const d = new Date(dateStr);
    const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
      next.setFullYear(today.getFullYear() + 1);
    return Math.round((next.getTime() - today.getTime()) / 86400000);
  }
  const holidayBirth = profile && daysToNext(profile.birth_date) != null && daysToNext(profile.birth_date)! <= 7;
  const holidayAnniv = profile && daysToNext(profile.anniversary_date) != null && daysToNext(profile.anniversary_date)! <= 7;
  const holidayPct = deliveryType === "delivery" ? 10 : 15;

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("categories").select("id,name,sort_order").eq("is_active", true).order("sort_order"),
        supabase.from("products").select("id,name,price,image_url,category_id,is_addon").eq("is_active", true).eq("in_stock", true).eq("is_semi_product", false).order("sort_order").limit(500),
      ]);
      setCats((c ?? []) as Category[]);
      setProds((p ?? []) as Product[]);
      if (c?.length) setActiveCat(c[0].id);
    })();
  }, []);

  useEffect(() => {
    if (isSuper && branches.length && !posBranch) setPosBranch(branches[0].id);
  }, [isSuper, branches, posBranch]);

  const effectiveBranch = isSuper ? posBranch : branchId;

  async function lookupClient() {
    setSearching(true);
    setProfile(null);
    setRecent([]);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length < 6) {
        toast.error("Введите телефон");
        return;
      }
      // Profile by phone (any match)
      const { data: profs } = await supabase
        .from("profiles").select("id,full_name,phone,email,bonus_balance,total_spent,birth_date,anniversary_date")
        .ilike("phone", `%${cleanPhone.slice(-10)}%`).limit(1);
      const p = (profs?.[0] ?? null) as Profile | null;
      if (p) {
        setProfile(p);
        if (p.full_name) setName(p.full_name);
      }
      // Recent orders by phone — regardless of user_id link
      const { data: ords } = await supabase
        .from("orders")
        .select("id,number,total,created_at,address,delivery_type,phone")
        .ilike("phone", `%${cleanPhone.slice(-10)}%`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecent((ords ?? []) as RecentOrder[]);
      if (!p && !ords?.length) toast.info("Клиент не найден — будет создан новый заказ без привязки");
    } finally {
      setSearching(false);
    }
  }

  async function repeatOrder(orderId: string) {
    const { data: items } = await supabase.from("order_items")
      .select("product_id,name,price,quantity").eq("order_id", orderId);
    if (!items?.length) return toast.error("Состав заказа пуст");
    setCart(items.map((it: any) => ({
      product_id: it.product_id,
      name: it.name,
      price: Number(it.price),
      quantity: it.quantity,
    })));
    toast.success("Состав загружен в корзину");
  }

  function addProduct(p: Product) {
    setCart((c) => {
      const idx = c.findIndex((x) => x.product_id === p.id);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...c, { product_id: p.id, name: p.name, price: Number(p.price), quantity: 1 }];
    });
  }
  function setQty(i: number, q: number) {
    setCart((c) => q <= 0 ? c.filter((_, k) => k !== i) : c.map((x, k) => k === i ? { ...x, quantity: q } : x));
  }

  const subtotal = useMemo(() => cart.reduce((a, x) => a + x.price * x.quantity, 0), [cart]);
  const discount = Math.round(subtotal * discountPct / 100);
  const bonusBalance = Math.floor(Number(profile?.bonus_balance || 0));
  const maxBonus = discountPct > 0 ? 0 : Math.min(bonusBalance, Math.floor(subtotal * 0.3));
  const bonusApplied = Math.min(bonusUse, maxBonus);
  const total = Math.max(0, subtotal - discount - bonusApplied);
  const bonusEarn = profile ? Math.floor((subtotal - bonusApplied) * 0.03) : 0;

  const filteredProds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prods.filter((p) => {
      if (q) return p.name.toLowerCase().includes(q);
      return p.category_id === activeCat;
    });
  }, [prods, activeCat, search]);

  async function placeOrder() {
    if (!cart.length) return toast.error("Корзина пуста");
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Укажите телефон клиента");
    if (deliveryType === "delivery" && !address.trim()) return toast.error("Укажите адрес доставки");
    if (!effectiveBranch) return toast.error("Не выбран филиал");

    setBusy(true);
    try {
      const order = await submit({
        data: {
          customer_user_id: profile?.id ?? null,
          order: {
            customer_name: name.trim() || "Клиент",
            phone: phone.trim(),
            delivery_type: deliveryType,
            address: deliveryType === "delivery" ? address.trim() : null,
            pickup_point: deliveryType === "pickup" ? "Самовывоз" : null,
            payment_method: paymentMethod,
            change_from: null,
            persons: 1,
            delivery_time: null,
            comment: comment.trim() || null,
            subtotal,
            delivery_cost: 0,
            discount,
            promo_code: discountPct > 0 ? `ADMIN-${discountPct}%` : null,
            bonus_used: bonusApplied,
            bonus_earned: bonusEarn,
            total,
            branch_id: effectiveBranch,
            admin_note: adminNote.trim() || `Заказ принят админом по телефону`,
          },
          items: cart,
        },
      });
      if (holidayKind) {
        await (supabase.from("orders") as any).update({ holiday_discount_kind: holidayKind }).eq("id", order.id);
      }
      toast.success(`Заказ №${order.number} создан`);
      // Reset
      setCart([]); setComment(""); setAdminNote(""); setDiscountPct(0); setBonusUse(0); setHolidayKind(null);
    } catch (e: any) {
      const { ruError } = await import("@/lib/errors");
      toast.error(ruError(e, "Не удалось создать заказ"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="text-neutral-400">Загрузка…</div>;

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">📞 Создание заказа</h1>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-5">
        {/* LEFT: catalog */}
        <div className="space-y-4">
          {/* Client lookup */}
          <div className="bg-white rounded-2xl p-4">
            <div className="text-sm font-bold mb-2">Клиент</div>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
              <input className={inp} placeholder="Телефон*" value={phone} type="tel" inputMode="tel" maxLength={18}
                onChange={(e) => setPhone(formatRuPhone(e.target.value))}
                onFocus={(e) => { if (!e.target.value) setPhone("+7 ("); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupClient(); } }} />
              <input className={inp} placeholder="Имя" value={name} onChange={(e) => setName(e.target.value.replace(/[^A-Za-zА-Яа-яЁё\s-]/g, ""))} maxLength={50} />
              <button onClick={lookupClient} disabled={searching}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold disabled:opacity-50">
                {searching ? "…" : "🔍 Найти"}
              </button>
            </div>
            {profile && (
              <div className="mt-3 text-xs bg-green-50 text-green-800 rounded-xl p-3">
                ✓ Клиент найден: <b>{profile.full_name ?? "—"}</b> · бонусы: <b>{Math.floor(profile.bonus_balance)}</b> · потрачено всего: <b>{Math.floor(profile.total_spent)} ₽</b>
              </div>
            )}
            {recent.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-neutral-500 mb-1.5">История заказов:</div>
                <div className="space-y-1.5">
                  {recent.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-xs bg-neutral-50 rounded-lg px-3 py-2">
                      <div className="truncate mr-2">
                        <span className="font-bold">#{o.number}</span>
                        <span className="text-neutral-500"> · {new Date(o.created_at).toLocaleDateString("ru")} · {Number(o.total)} ₽</span>
                        {o.address && <span className="text-neutral-500"> · {o.address}</span>}
                      </div>
                      <button onClick={() => { repeatOrder(o.id); if (o.address) setAddress(o.address); }}
                        className="px-2.5 py-1 rounded-full bg-primary text-white font-semibold whitespace-nowrap">
                        ↻ Повторить
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Catalog */}
          <div className="bg-white rounded-2xl p-4">
            <input className={inp + " mb-3"} placeholder="🔍 Поиск товара..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {!search && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
                {cats.map((c) => (
                  <button key={c.id} onClick={() => setActiveCat(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                      activeCat === c.id ? "bg-primary text-white" : "bg-neutral-100 hover:bg-neutral-200"
                    }`}>{c.name}</button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto">
              {filteredProds.map((p) => (
                <button key={p.id} onClick={() => addProduct(p)}
                  className="text-left rounded-xl border border-neutral-100 hover:border-primary hover:bg-primary/5 p-2 transition">
                  <div className="aspect-square rounded-lg bg-neutral-50 grid place-items-center overflow-hidden text-2xl mb-1.5">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : "🍣"}
                  </div>
                  <div className="text-xs font-semibold line-clamp-2 leading-snug min-h-[2.2em]">{p.name}</div>
                  <div className="text-sm font-extrabold mt-1">{Number(p.price)} ₽</div>
                </button>
              ))}
              {!filteredProds.length && <div className="col-span-full py-8 text-center text-neutral-400 text-sm">Нет товаров</div>}
            </div>
          </div>
        </div>

        {/* RIGHT: cart + form */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4">
            <div className="font-bold mb-2 text-sm">Корзина ({cart.length})</div>
            {!cart.length && <div className="text-xs text-neutral-400 py-4 text-center">Добавьте товары из каталога</div>}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {cart.map((it, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="flex-1 truncate">{it.name}</div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(i, it.quantity - 1)} className="h-7 w-7 rounded-full bg-neutral-100 font-bold">−</button>
                    <span className="w-6 text-center text-xs font-bold">{it.quantity}</span>
                    <button onClick={() => setQty(i, it.quantity + 1)} className="h-7 w-7 rounded-full bg-primary text-white font-bold">+</button>
                  </div>
                  <div className="w-16 text-right font-semibold">{it.price * it.quantity} ₽</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 space-y-3">
            <div className="font-bold text-sm">Доставка</div>
            <div className="grid grid-cols-2 gap-2">
              {(["delivery", "pickup"] as const).map((t) => (
                <button key={t} onClick={() => setDeliveryType(t)}
                  className={`py-2 rounded-xl text-sm font-semibold border-2 ${
                    deliveryType === t ? "border-primary bg-primary/5 text-primary" : "border-neutral-200 text-neutral-700"
                  }`}>{t === "delivery" ? "🛵 Доставка" : "🏪 Самовывоз"}</button>
              ))}
            </div>
            {deliveryType === "delivery" && (
              <input className={inp} placeholder="Адрес: улица, дом, кв., подъезд, этаж*"
                value={address} onChange={(e) => setAddress(e.target.value)} />
            )}
            <input className={inp} placeholder="Комментарий клиента"
              value={comment} onChange={(e) => setComment(e.target.value)} />
            {isSuper && branches.length > 1 && (
              <select className={inp} value={posBranch} onChange={(e) => setPosBranch(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>Филиал: {b.name}</option>)}
              </select>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 space-y-3">
            <div className="font-bold text-sm">Оплата и скидки</div>
            <div className="grid grid-cols-3 gap-1.5">
              {([["cash", "Наличные"], ["card_courier", "Карта"], ["card_online", "Онлайн"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setPaymentMethod(v)}
                  className={`py-2 rounded-xl text-xs font-semibold border-2 ${
                    paymentMethod === v ? "border-primary bg-primary/5 text-primary" : "border-neutral-200"
                  }`}>{l}</button>
              ))}
            </div>
            {(holidayBirth || holidayAnniv) && (
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-3 space-y-2">
                <div className="text-xs font-bold text-purple-900">
                  🎉 У клиента праздник: {holidayBirth ? `🎂 День рождения (через ${daysToNext(profile!.birth_date)}д)` : ""}
                  {holidayBirth && holidayAnniv ? " · " : ""}
                  {holidayAnniv ? `💍 Годовщина (через ${daysToNext(profile!.anniversary_date)}д)` : ""}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {holidayBirth && (
                    <button onClick={() => { setDiscountPct(holidayPct); setHolidayKind("birthday"); setBonusUse(0); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${holidayKind === "birthday" ? "bg-pink-500 text-white" : "bg-white border border-pink-300 text-pink-700"}`}>
                      🎂 Применить {holidayPct}%
                    </button>
                  )}
                  {holidayAnniv && (
                    <button onClick={() => { setDiscountPct(holidayPct); setHolidayKind("anniversary"); setBonusUse(0); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold ${holidayKind === "anniversary" ? "bg-purple-500 text-white" : "bg-white border border-purple-300 text-purple-700"}`}>
                      💍 Применить {holidayPct}%
                    </button>
                  )}
                  {holidayKind && (
                    <button onClick={() => { setHolidayKind(null); setDiscountPct(0); }}
                      className="px-3 py-1.5 rounded-full text-xs bg-neutral-100">Убрать</button>
                  )}
                </div>
                <div className="text-[10px] text-neutral-500">
                  Доставка — 10%, самовывоз — 15% (текущий способ: {deliveryType === "delivery" ? "доставка" : "самовывоз"})
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-neutral-600 mb-1">Скидка, %</div>
              <div className="flex gap-1.5 flex-wrap">
                {[0, 5, 10, 15, 20, 25, 30].map((v) => (
                  <button key={v} onClick={() => setDiscountPct(v)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      discountPct === v ? "bg-primary text-white" : "bg-neutral-100 hover:bg-neutral-200"
                    }`}>{v}%</button>
                ))}
                <input type="number" min={0} max={100} value={discountPct}
                  onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  className="w-16 px-2 py-1.5 rounded-full text-xs border text-center" />
              </div>
            </div>
            {profile && bonusBalance > 0 && (
              <div>
                <div className="text-xs text-neutral-600 mb-1">Бонусы (доступно {bonusBalance}, можно списать до {maxBonus})</div>
                <input type="number" min={0} max={maxBonus} value={bonusUse}
                  onChange={(e) => setBonusUse(Math.max(0, Math.min(maxBonus, Number(e.target.value) || 0)))}
                  className={inp} disabled={discountPct > 0} />
                {discountPct > 0 && <div className="text-[10px] text-neutral-400 mt-1">Скидка и бонусы не суммируются</div>}
              </div>
            )}
            <input className={inp} placeholder="Заметка администратора (необязательно)"
              value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
          </div>

          <div className="bg-white rounded-2xl p-4 space-y-1.5 text-sm">
            <Row k="Товары" v={`${subtotal} ₽`} />
            {discount > 0 && <Row k={`Скидка ${discountPct}%`} v={`−${discount} ₽`} accent />}
            {bonusApplied > 0 && <Row k="Бонусы" v={`−${bonusApplied} ₽`} accent />}
            <div className="border-t pt-2 mt-2 flex justify-between text-lg font-extrabold">
              <span>Итого</span><span>{total} ₽</span>
            </div>
            {bonusEarn > 0 && profile && <div className="text-xs text-amber-600">+ {bonusEarn} бонусов клиенту</div>}
          </div>

          <button onClick={placeOrder} disabled={busy || !cart.length}
            className="w-full py-4 rounded-2xl bg-primary text-white font-extrabold text-lg disabled:opacity-50">
            {busy ? "Создаём…" : "Оформить заказ"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-primary";
function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return <div className="flex justify-between"><span className="text-neutral-600">{k}</span><span className={accent ? "text-primary font-semibold" : "font-semibold"}>{v}</span></div>;
}
