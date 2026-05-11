import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ruError } from "@/lib/errors";
import { useCart } from "@/lib/cart";
import { TIERS, tierFromTotal, nextTier, type Tier } from "@/lib/loyalty";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Личный кабинет — КосмоСуши" }] }),
  component: Account,
});

type TabKey = "orders" | "profile" | "addresses" | "loyalty" | "favorites" | "combos" | "referrals";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "orders", label: "Заказы", icon: "📦" },
  { key: "profile", label: "Профиль", icon: "👤" },
  { key: "addresses", label: "Адреса", icon: "📍" },
  { key: "loyalty", label: "Бонусы и уровни", icon: "⭐" },
  { key: "favorites", label: "Избранное", icon: "❤️" },
  { key: "combos", label: "Мои наборы", icon: "🍱" },
  { key: "referrals", label: "Пригласить друга", icon: "🎁" },
];

function Account() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [tab, setTab] = useState<TabKey>("orders");
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const init = async (u: { id: string; email: string | null } | null) => {
      if (cancelled) return;
      if (!u) {
        nav({ to: "/account-login", search: { redirect: "/account" } } as any);
        return;
      }
      setUser(u);
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
      if (cancelled) return;
      setProfile(p);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user;
      init(u ? { id: u.id, email: u.email ?? null } : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      if (event === "SIGNED_OUT" || !session?.user) {
        setTimeout(() => nav({ to: "/account-login", search: { redirect: "/account" } } as any), 0);
      }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [nav]);

  if (loading || !user) return <div className="min-h-screen grid place-items-center text-neutral-500">Загружаем…</div>;

  const tier: Tier = tierFromTotal(Number(profile?.total_spent || 0));

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b">
        <div className="mx-auto max-w-[1280px] px-6 h-20 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-10 w-10" />
            <span className="font-extrabold text-xl">КосмоСуши</span>
          </Link>
          <Link to="/" className="ml-auto text-sm text-neutral-600 hover:text-primary">← В меню</Link>
          <button onClick={async () => { await supabase.auth.signOut(); nav({ to: "/" }); }}
            className="text-sm text-neutral-600 hover:text-primary">Выйти</button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">Личный кабинет</h1>
            <p className="text-neutral-500 mt-1">{profile?.full_name || user.email}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="px-4 py-2 rounded-full font-bold text-white text-sm" style={{ background: TIERS[tier].color }}>
              {TIERS[tier].label}
            </div>
            <div className="px-4 py-2 rounded-full bg-amber-50 text-amber-700 font-bold text-sm">
              {Math.floor(Number(profile?.bonus_balance || 0))} ₽ бонусов
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <aside className="bg-white rounded-2xl p-2 h-fit lg:sticky lg:top-6">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition ${
                  tab === t.key ? "bg-primary text-white" : "hover:bg-neutral-50 text-neutral-700"
                }`}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </aside>

          <section>
            {tab === "orders" && <OrdersTab userId={user.id} />}
            {tab === "profile" && <ProfileTab profile={profile} email={user.email} onSaved={(p) => setProfile(p)} />}
            {tab === "addresses" && <AddressesTab userId={user.id} />}
            {tab === "loyalty" && <LoyaltyTab profile={profile} userId={user.id} />}
            {tab === "favorites" && <FavoritesTab userId={user.id} />}
            {tab === "combos" && <CombosTab userId={user.id} />}
            {tab === "referrals" && <ReferralsTab profile={profile} />}
          </section>
        </div>
      </main>
    </div>
  );
}

/* ============== ORDERS ============== */

const STATUS_LABEL: Record<string, string> = {
  new: "Новый", confirmed: "Подтверждён", cooking: "Готовится",
  delivering: "В пути", done: "Выполнен", cancelled: "Отменён",
};
const TIMELINE: { key: string; label: string }[] = [
  { key: "new", label: "Принят" },
  { key: "confirmed", label: "Подтверждён" },
  { key: "cooking", label: "Готовится" },
  { key: "delivering", label: "В пути" },
  { key: "done", label: "Доставлен" },
];

function OrdersTab({ userId }: { userId: string }) {
  const cart = useCart();
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [reviews, setReviews] = useState<Record<string, any>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: ord } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(ord ?? []);
    if (ord?.length) {
      const ids = ord.map((o: any) => o.id);
      const [{ data: its }, { data: rvs }] = await Promise.all([
        supabase.from("order_items").select("*").in("order_id", ids),
        supabase.from("reviews").select("*").in("order_id", ids),
      ]);
      const grouped: Record<string, any[]> = {};
      its?.forEach((it: any) => (grouped[it.order_id] ||= []).push(it));
      setItems(grouped);
      const rv: Record<string, any> = {};
      rvs?.forEach((r: any) => (rv[r.order_id] = r));
      setReviews(rv);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [userId]);

  async function repeat(orderId: string) {
    const list = items[orderId] ?? [];
    const ids = list.map((x) => x.product_id).filter(Boolean) as string[];
    const { data: prods } = await supabase.from("products").select("*").in("id", ids);
    const byId = new Map((prods ?? []).map((p: any) => [p.id, p]));
    let added = 0, skipped = 0;
    for (const it of list) {
      const p = it.product_id ? byId.get(it.product_id) : null;
      if (p && p.is_active && p.in_stock) {
        cart.add({ id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url, weight: p.weight }, it.quantity);
        added++;
      } else skipped++;
    }
    if (added) toast.success(`Добавлено: ${added}`, skipped ? { description: `Недоступно: ${skipped}` } : undefined);
    else toast.error("Товары больше не доступны");
    cart.setOpen(true);
  }

  async function cancel(id: string) {
    if (!confirm("Отменить заказ?")) return;
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(ruError(error)); else { toast.success("Заказ отменён"); load(); }
  }

  function printReceipt(o: any) {
    const list = items[o.id] ?? [];
    const html = `
<!doctype html><html><head><meta charset="utf-8"><title>Чек №${o.number}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:auto}
h1{font-size:20px;margin:0 0 8px}.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #ddd}
.tot{font-weight:800;font-size:18px;border-top:2px solid #000;margin-top:12px;padding-top:8px}</style></head>
<body><h1>КосмоСуши — Чек №${o.number}</h1>
<div>${new Date(o.created_at).toLocaleString("ru")}</div>
<div>${o.customer_name} · ${o.phone}</div>
<div>${o.delivery_type === "delivery" ? "Доставка: " + (o.address || "") : "Самовывоз: " + (o.pickup_point || "")}</div>
<hr>${list.map((it: any) => `<div class="row"><span>${it.name} × ${it.quantity}</span><span>${it.quantity * Number(it.price)} ₽</span></div>`).join("")}
<div class="row"><span>Сумма</span><span>${Number(o.subtotal)} ₽</span></div>
${Number(o.discount) > 0 ? `<div class="row"><span>Скидка</span><span>−${Number(o.discount)} ₽</span></div>` : ""}
${Number(o.bonus_used) > 0 ? `<div class="row"><span>Бонусы</span><span>−${Number(o.bonus_used)} ₽</span></div>` : ""}
<div class="row"><span>Доставка</span><span>${Number(o.delivery_cost)} ₽</span></div>
<div class="row tot"><span>Итого</span><span>${Number(o.total)} ₽</span></div>
<p style="text-align:center;margin-top:24px;color:#888">Спасибо за заказ!</p>
<script>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  if (loading) return <Loader />;
  if (!orders.length) return <Empty icon="📦" text="У вас ещё нет заказов" cta={<Link to="/" className="inline-block px-6 py-3 rounded-full bg-primary text-white font-bold">К меню</Link>} />;

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const isOpen = open === o.id;
        const stepIdx = TIMELINE.findIndex((s) => s.key === o.status);
        const cancelled = o.status === "cancelled";
        const canCancel = o.status === "new";
        const done = o.status === "done";
        return (
          <div key={o.id} className="bg-white rounded-2xl overflow-hidden">
            <button onClick={() => setOpen(isOpen ? null : o.id)} className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-neutral-50">
              <div className="flex-1">
                <div className="font-bold">Заказ №{o.number}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{new Date(o.created_at).toLocaleString("ru")} · {o.delivery_type === "delivery" ? "Доставка" : "Самовывоз"}</div>
              </div>
              <span className={`hidden sm:inline-block px-3 py-1 rounded-full text-xs font-bold ${cancelled ? "bg-red-100 text-red-700" : done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
              <div className="font-extrabold text-lg whitespace-nowrap">{Number(o.total)} ₽</div>
              <span className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {isOpen && (
              <div className="border-t p-5 bg-neutral-50/50">
                {!cancelled && (
                  <div className="mb-5 flex gap-1 overflow-x-auto">
                    {TIMELINE.map((s, i) => (
                      <div key={s.key} className="flex-1 min-w-[80px]">
                        <div className={`h-2 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-neutral-200"}`} />
                        <div className={`text-xs mt-1.5 font-semibold ${i <= stepIdx ? "text-primary" : "text-neutral-400"}`}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2 mb-4">
                  {(items[o.id] ?? []).map((it: any) => (
                    <div key={it.id} className="flex justify-between text-sm">
                      <div className="flex-1"><div className="font-medium">{it.name}</div><div className="text-xs text-neutral-500">{it.quantity} × {Number(it.price)} ₽</div></div>
                      <div className="font-semibold">{it.quantity * Number(it.price)} ₽</div>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-neutral-600 space-y-0.5 mb-4 border-t pt-3">
                  <div className="flex justify-between"><span>Сумма</span><span>{Number(o.subtotal)} ₽</span></div>
                  {Number(o.discount) > 0 && <div className="flex justify-between text-emerald-700"><span>Скидка{o.promo_code ? ` (${o.promo_code})` : ""}</span><span>−{Number(o.discount)} ₽</span></div>}
                  {Number(o.bonus_used) > 0 && <div className="flex justify-between text-amber-700"><span>Бонусы</span><span>−{Number(o.bonus_used)} ₽</span></div>}
                  <div className="flex justify-between"><span>Доставка</span><span>{Number(o.delivery_cost)} ₽</span></div>
                  <div className="flex justify-between font-extrabold text-base text-neutral-900 pt-1"><span>Итого</span><span>{Number(o.total)} ₽</span></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => repeat(o.id)} className="px-5 py-2.5 rounded-full bg-primary text-white font-bold hover:opacity-90">🔁 Повторить</button>
                  <button onClick={() => printReceipt(o)} className="px-5 py-2.5 rounded-full bg-neutral-100 font-bold hover:bg-neutral-200">🧾 Чек / Печать</button>
                  {canCancel && <button onClick={() => cancel(o.id)} className="px-5 py-2.5 rounded-full bg-red-50 text-red-700 font-bold hover:bg-red-100">Отменить</button>}
                  {done && !reviews[o.id] && <ReviewForm orderId={o.id} userId={userId} onDone={load} />}
                  {reviews[o.id] && <div className="px-4 py-2 text-sm text-neutral-600">Ваша оценка: {"★".repeat(reviews[o.id].rating)}{"☆".repeat(5 - reviews[o.id].rating)}</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReviewForm({ orderId, userId, onDone }: { orderId: string; userId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="px-5 py-2.5 rounded-full bg-amber-100 text-amber-800 font-bold hover:bg-amber-200">⭐ Оставить отзыв</button>;
  return (
    <div className="w-full bg-white rounded-2xl p-4 border">
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} className={`text-3xl ${n <= rating ? "text-amber-400" : "text-neutral-300"}`}>★</button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Поделитесь впечатлениями…" className="w-full p-3 border rounded-xl text-sm min-h-[80px]" />
      <div className="flex gap-2 mt-3">
        <button onClick={async () => {
          if (!rating) return toast.error("Поставьте оценку");
          const { error } = await supabase.from("reviews").insert({ order_id: orderId, user_id: userId, rating, comment: text || null });
          if (error) toast.error(ruError(error)); else { toast.success("Спасибо за отзыв!"); setOpen(false); onDone(); }
        }} className="px-5 py-2 rounded-full bg-primary text-white font-bold">Отправить</button>
        <button onClick={() => setOpen(false)} className="px-5 py-2 rounded-full bg-neutral-100 font-bold">Отмена</button>
      </div>
    </div>
  );
}

/* ============== PROFILE ============== */

function ProfileTab({ profile, email, onSaved }: { profile: any; email: string | null; onSaved: (p: any) => void }) {
  const [f, setF] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    email: profile?.email ?? email ?? "",
    birth_date: profile?.birth_date ?? "",
  });
  const [pwd, setPwd] = useState({ a: "", b: "" });
  const [pwdOpen, setPwdOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data, error } = await supabase.from("profiles").update({
      full_name: f.full_name.trim(),
      phone: f.phone.trim(),
      email: f.email.trim() || null,
      birth_date: f.birth_date || null,
    }).eq("id", profile.id).select().maybeSingle();
    setSaving(false);
    if (error) return toast.error(ruError(error));
    toast.success("Сохранено");
    onSaved(data);
  }

  async function changePassword() {
    if (pwd.a.length < 6) return toast.error("Пароль минимум 6 символов");
    if (pwd.a !== pwd.b) return toast.error("Пароли не совпадают");
    const { error } = await supabase.auth.updateUser({ password: pwd.a });
    if (error) return toast.error(ruError(error));
    toast.success("Пароль изменён");
    setPwd({ a: "", b: "" });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <h3 className="font-extrabold text-lg">Личные данные</h3>
        <Field label="Имя"><input className={inp} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Телефон"><input className={inp} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email"><input type="email" className={inp} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Дата рождения"><input type="date" className={inp} value={f.birth_date ?? ""} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></Field>
        <button onClick={save} disabled={saving} className="px-6 py-3 rounded-full bg-primary text-white font-bold disabled:opacity-50">Сохранить</button>
      </div>
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <button
          type="button"
          onClick={() => setPwdOpen((v) => !v)}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={pwdOpen}
        >
          <h3 className="font-extrabold text-lg">Смена пароля</h3>
          <span className={`text-2xl text-neutral-400 transition-transform ${pwdOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>
        {pwdOpen && (
          <div className="space-y-4">
            <Field label="Новый пароль"><input type="password" className={inp} value={pwd.a} onChange={(e) => setPwd({ ...pwd, a: e.target.value })} /></Field>
            <Field label="Повторите пароль"><input type="password" className={inp} value={pwd.b} onChange={(e) => setPwd({ ...pwd, b: e.target.value })} /></Field>
            <button onClick={changePassword} className="px-6 py-3 rounded-full bg-primary text-white font-bold">Изменить пароль</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============== ADDRESSES ============== */

function AddressesTab({ userId }: { userId: string }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("addresses").select("*").order("created_at", { ascending: false });
    setList(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [userId]);

  async function save(a: any) {
    const payload = { user_id: userId, label: a.label || null, address: a.address.trim(), entrance: a.entrance || null, floor: a.floor || null, apartment: a.apartment || null, comment: a.comment || null, is_default: !!a.is_default };
    if (!payload.address) return toast.error("Укажите адрес");
    if (payload.is_default) await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    const { error } = a.id
      ? await supabase.from("addresses").update(payload).eq("id", a.id)
      : await supabase.from("addresses").insert(payload);
    if (error) return toast.error(ruError(error));
    toast.success("Сохранено"); setEdit(null); load();
  }
  async function del(id: string) {
    if (!confirm("Удалить адрес?")) return;
    await supabase.from("addresses").delete().eq("id", id); load();
  }
  async function makeDefault(id: string) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    load();
  }

  if (loading) return <Loader />;
  return (
    <div className="space-y-3">
      <button onClick={() => setEdit({ address: "", is_default: list.length === 0 })} className="px-5 py-3 rounded-full bg-primary text-white font-bold">+ Добавить адрес</button>
      {!list.length && !edit && <Empty icon="📍" text="Нет сохранённых адресов" />}
      {list.map((a) => (
        <div key={a.id} className="bg-white rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {a.label && <div className="text-xs text-neutral-500 font-bold uppercase">{a.label}</div>}
              <div className="font-bold">{a.address}</div>
              <div className="text-sm text-neutral-500">
                {[a.entrance && `подъезд ${a.entrance}`, a.floor && `этаж ${a.floor}`, a.apartment && `кв. ${a.apartment}`].filter(Boolean).join(" · ")}
              </div>
              {a.comment && <div className="text-sm text-neutral-500 mt-1">{a.comment}</div>}
            </div>
            {a.is_default && <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">По умолчанию</span>}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 text-sm">
            {!a.is_default && <button onClick={() => makeDefault(a.id)} className="px-3 py-1.5 rounded-full bg-neutral-100 font-semibold">Сделать основным</button>}
            <button onClick={() => setEdit(a)} className="px-3 py-1.5 rounded-full bg-neutral-100 font-semibold">Редактировать</button>
            <button onClick={() => del(a.id)} className="px-3 py-1.5 rounded-full bg-red-50 text-red-700 font-semibold">Удалить</button>
          </div>
        </div>
      ))}
      {edit && (
        <div className="bg-white rounded-2xl p-6 space-y-3 border-2 border-primary">
          <Field label="Метка (Дом, Работа…)"><input className={inp} value={edit.label ?? ""} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></Field>
          <Field label="Адрес*"><input className={inp} value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Подъезд"><input className={inp} value={edit.entrance ?? ""} onChange={(e) => setEdit({ ...edit, entrance: e.target.value })} /></Field>
            <Field label="Этаж"><input className={inp} value={edit.floor ?? ""} onChange={(e) => setEdit({ ...edit, floor: e.target.value })} /></Field>
            <Field label="Квартира"><input className={inp} value={edit.apartment ?? ""} onChange={(e) => setEdit({ ...edit, apartment: e.target.value })} /></Field>
          </div>
          <Field label="Комментарий"><input className={inp} value={edit.comment ?? ""} onChange={(e) => setEdit({ ...edit, comment: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!edit.is_default} onChange={(e) => setEdit({ ...edit, is_default: e.target.checked })} /> Основной адрес</label>
          <div className="flex gap-2">
            <button onClick={() => save(edit)} className="px-5 py-2.5 rounded-full bg-primary text-white font-bold">Сохранить</button>
            <button onClick={() => setEdit(null)} className="px-5 py-2.5 rounded-full bg-neutral-100 font-bold">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== LOYALTY ============== */

function LoyaltyTab({ profile, userId }: { profile: any; userId: string }) {
  const [tx, setTx] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const tier = tierFromTotal(Number(profile?.total_spent || 0));
  const next = nextTier(tier);
  const total = Number(profile?.total_spent || 0);
  const progress = next ? Math.min(100, (total / next.need) * 100) : 100;

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from("bonus_transactions").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("promo_codes").select("*").eq("user_id", userId).eq("is_active", true),
      ]);
      setTx(t ?? []); setPromos(p ?? []);
    })();
  }, [userId]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-primary to-amber-500 text-white rounded-3xl p-6">
        <div className="text-sm opacity-80">Бонусный баланс</div>
        <div className="text-5xl font-extrabold mt-1">{Math.floor(Number(profile?.bonus_balance || 0))} ₽</div>
        <div className="mt-3 text-sm opacity-90">Тратьте до 30% от суммы заказа</div>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-2xl font-extrabold">Уровень: {TIERS[tier].label}</div>
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-sm">{TIERS[tier].cashback}% кэшбэк</span>
          {TIERS[tier].discount > 0 && <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm">−{TIERS[tier].discount}% скидка</span>}
        </div>
        {next && (
          <>
            <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-sm text-neutral-500 mt-2">До уровня «{TIERS[next.tier].label}» осталось {Math.max(0, next.need - total)} ₽</div>
          </>
        )}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {(["bronze", "silver", "gold"] as Tier[]).map((t) => (
            <div key={t} className={`p-3 rounded-xl border-2 ${tier === t ? "border-primary" : "border-neutral-100"}`}>
              <div className="font-bold" style={{ color: TIERS[t].color }}>{TIERS[t].label}</div>
              <div className="text-xs text-neutral-500">от {TIERS[t].min} ₽</div>
              <div className="text-xs mt-1">кэшбэк {TIERS[t].cashback}%</div>
              {TIERS[t].discount > 0 && <div className="text-xs">скидка {TIERS[t].discount}%</div>}
            </div>
          ))}
        </div>
      </div>

      {promos.length > 0 && (
        <div className="bg-white rounded-2xl p-6">
          <h3 className="font-extrabold text-lg mb-3">Ваши промокоды</h3>
          <div className="space-y-2">
            {promos.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50">
                <div>
                  <div className="font-extrabold tracking-wider">{p.code}</div>
                  <div className="text-xs text-neutral-500">{p.discount_type === "percent" ? `−${p.discount_value}%` : `−${p.discount_value} ₽`}{p.expires_at ? ` · до ${new Date(p.expires_at).toLocaleDateString("ru")}` : ""}</div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(p.code); toast.success("Скопировано"); }} className="px-3 py-1.5 rounded-full bg-primary text-white text-sm font-bold">Копировать</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6">
        <h3 className="font-extrabold text-lg mb-3">История бонусов</h3>
        {!tx.length ? <div className="text-sm text-neutral-500">История пуста</div> : (
          <div className="space-y-1">
            {tx.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                <div><div className="font-semibold">{t.reason}</div><div className="text-xs text-neutral-500">{new Date(t.created_at).toLocaleString("ru")}</div></div>
                <div className={`font-extrabold ${Number(t.amount) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount)} ₽</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============== FAVORITES ============== */

function FavoritesTab({ userId }: { userId: string }) {
  const cart = useCart();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: favs } = await supabase.from("favorites").select("product_id").eq("user_id", userId);
    const ids = (favs ?? []).map((f: any) => f.product_id);
    if (!ids.length) { setItems([]); setLoading(false); return; }
    const { data: prods } = await supabase.from("products").select("*").in("id", ids).eq("is_active", true);
    setItems(prods ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [userId]);

  async function unfav(id: string) {
    await supabase.from("favorites").delete().eq("user_id", userId).eq("product_id", id);
    setItems((cur) => cur.filter((p) => p.id !== id));
  }

  if (loading) return <Loader />;
  if (!items.length) return <Empty icon="❤️" text="Пока ничего не добавлено в избранное" cta={<Link to="/" className="inline-block px-6 py-3 rounded-full bg-primary text-white font-bold">К меню</Link>} />;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((p) => (
        <div key={p.id} className="bg-white rounded-2xl overflow-hidden">
          <div className="aspect-square bg-neutral-100 grid place-items-center text-5xl">
            {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : "🍣"}
          </div>
          <div className="p-4">
            <div className="font-bold line-clamp-2 min-h-[2.6em]">{p.name}</div>
            <div className="text-xs text-neutral-500">{p.weight}</div>
            <div className="flex items-center justify-between mt-3">
              <div className="font-extrabold text-lg">{Number(p.price)} ₽</div>
              <div className="flex gap-1">
                <button onClick={() => unfav(p.id)} className="h-9 w-9 rounded-full bg-neutral-100">✕</button>
                <button onClick={() => { cart.add({ id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url, weight: p.weight }); cart.setOpen(true); }} className="h-9 px-4 rounded-full bg-primary text-white font-bold">+</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============== COMBOS (saved bundles) ============== */

function CombosTab({ userId }: { userId: string }) {
  const cart = useCart();
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from("combos").select("*").order("created_at", { ascending: false });
    setList(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [userId]);

  async function saveCurrent() {
    if (!cart.items.length) return toast.error("Корзина пуста");
    if (!name.trim()) return toast.error("Введите название");
    const items = cart.items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, image_url: i.image_url, weight: i.weight }));
    const { error } = await supabase.from("combos").insert({ user_id: userId, name: name.trim(), items });
    if (error) return toast.error(ruError(error));
    toast.success("Набор сохранён"); setName(""); load();
  }
  async function del(id: string) {
    if (!confirm("Удалить набор?")) return;
    await supabase.from("combos").delete().eq("id", id); load();
  }
  function loadCombo(c: any) {
    (c.items as any[]).forEach((it) => cart.add({ id: it.id, name: it.name, price: Number(it.price), image_url: it.image_url, weight: it.weight }, it.quantity));
    cart.setOpen(true);
  }

  if (loading) return <Loader />;
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-5">
        <div className="font-extrabold mb-2">Сохранить текущую корзину как набор</div>
        <div className="flex gap-2">
          <input className={inp + " flex-1"} placeholder="Например, Семейный ужин" value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={saveCurrent} className="px-5 py-2.5 rounded-full bg-primary text-white font-bold">Сохранить</button>
        </div>
        <div className="text-xs text-neutral-500 mt-2">В корзине сейчас: {cart.count} поз.</div>
      </div>
      {!list.length ? <Empty icon="🍱" text="Нет сохранённых наборов" /> :
        list.map((c) => {
          const total = (c.items as any[]).reduce((s, i) => s + Number(i.price) * i.quantity, 0);
          return (
            <div key={c.id} className="bg-white rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="font-extrabold text-lg">{c.name}</div>
                  <div className="text-sm text-neutral-500">{(c.items as any[]).length} поз. · {total} ₽</div>
                  <div className="text-xs text-neutral-500 mt-1 line-clamp-2">{(c.items as any[]).map((i) => `${i.name} ×${i.quantity}`).join(", ")}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => loadCombo(c)} className="px-5 py-2 rounded-full bg-primary text-white font-bold">В корзину</button>
                <button onClick={() => del(c.id)} className="px-5 py-2 rounded-full bg-red-50 text-red-700 font-bold">Удалить</button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

/* ============== REFERRALS ============== */

function ReferralsTab({ profile }: { profile: any }) {
  const code = profile?.referral_code || "—";
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${code}` : "";
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-fuchsia-500 to-primary text-white rounded-3xl p-6">
        <div className="text-2xl font-extrabold">Пригласите друга</div>
        <p className="opacity-90 mt-1 text-sm">Друг получит 300 ₽ бонусов на первый заказ. Вы получите 300 ₽ после его первой покупки.</p>
      </div>
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <Field label="Ваш реферальный код">
          <div className="flex gap-2">
            <input readOnly className={inp + " font-extrabold tracking-widest text-lg"} value={code} />
            <button onClick={() => { navigator.clipboard.writeText(code); toast.success("Скопировано"); }} className="px-5 rounded-xl bg-primary text-white font-bold">Копировать</button>
          </div>
        </Field>
        <Field label="Реферальная ссылка">
          <div className="flex gap-2">
            <input readOnly className={inp + " text-sm"} value={link} />
            <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Скопировано"); }} className="px-5 rounded-xl bg-primary text-white font-bold">Копировать</button>
          </div>
        </Field>
      </div>
    </div>
  );
}

/* ============== UI ============== */

const inp = "w-full px-4 py-3 rounded-xl border border-neutral-200 outline-none focus:border-primary text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><div className="text-xs font-bold text-neutral-500 mb-1.5">{label}</div>{children}</label>;
}
function Loader() { return <div className="py-12 text-center text-neutral-500">Загружаем…</div>; }
function Empty({ icon, text, cta }: { icon: string; text: string; cta?: React.ReactNode }) {
  return <div className="bg-white rounded-3xl p-10 text-center"><div className="text-5xl mb-3">{icon}</div><p className="text-neutral-500 mb-4">{text}</p>{cta}</div>;
}
