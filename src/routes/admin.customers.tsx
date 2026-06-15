import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/customers")({ component: Customers });

type Row = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  bonus_balance: number;
  total_spent: number;
  created_at: string;
  birth_date: string | null;
  anniversary_date: string | null;
  orders_count: number;
  last_order: string | null;
  avg_check: number;
};

function daysToNext(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  const d = new Date(dateStr);
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    next.setFullYear(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function holidayBadge(birth: string | null, anniv: string | null) {
  for (const [d, label, cls] of [
    [birth, "🎂", "bg-pink-100 text-pink-700"],
    [anniv, "💍", "bg-purple-100 text-purple-700"],
  ] as const) {
    if (!d) continue;
    const n = daysToNext(d);
    if (n != null && n <= 7) return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{label} {n === 0 ? "сегодня" : `через ${n}д`}</span>;
  }
  return null;
}

function Customers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"spent" | "orders" | "recent" | "holiday">("spent");
  const [edit, setEdit] = useState<Row | null>(null);

  async function load() {
    const { data: profiles } = await supabase.from("profiles")
      .select("id,full_name,phone,email,bonus_balance,total_spent,created_at,birth_date,anniversary_date");
    const { data: orders } = await supabase.from("orders")
      .select("user_id,total,created_at,status")
      .is("deleted_at", null)
      .neq("status", "cancelled");
    const byUser: Record<string, { count: number; sum: number; last: string | null }> = {};
    (orders ?? []).forEach((o: any) => {
      if (!o.user_id) return;
      const r = byUser[o.user_id] ??= { count: 0, sum: 0, last: null };
      r.count++; r.sum += Number(o.total);
      if (!r.last || o.created_at > r.last) r.last = o.created_at;
    });
    const merged: Row[] = (profiles ?? []).map((p: any) => {
      const s = byUser[p.id] ?? { count: 0, sum: 0, last: null };
      return {
        ...p,
        orders_count: s.count,
        last_order: s.last,
        avg_check: s.count ? Math.round(s.sum / s.count) : 0,
      };
    });
    setRows(merged);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    let r = rows;
    if (ql) r = r.filter((x) =>
      (x.full_name ?? "").toLowerCase().includes(ql) ||
      (x.phone ?? "").includes(ql) ||
      (x.email ?? "").toLowerCase().includes(ql)
    );
    return [...r].sort((a, b) => {
      if (sort === "spent") return Number(b.total_spent) - Number(a.total_spent);
      if (sort === "orders") return b.orders_count - a.orders_count;
      if (sort === "holiday") {
        const da = Math.min(daysToNext(a.birth_date) ?? 999, daysToNext(a.anniversary_date) ?? 999);
        const db = Math.min(daysToNext(b.birth_date) ?? 999, daysToNext(b.anniversary_date) ?? 999);
        return da - db;
      }
      return (b.last_order ?? "").localeCompare(a.last_order ?? "");
    });
  }, [rows, q, sort]);

  const totalSpent = filtered.reduce((a, r) => a + Number(r.total_spent), 0);
  const upcomingHolidays = rows.filter((r) => {
    const n = Math.min(daysToNext(r.birth_date) ?? 999, daysToNext(r.anniversary_date) ?? 999);
    return n <= 7;
  }).length;

  async function saveEdit() {
    if (!edit) return;
    const { error } = await (supabase.from("profiles") as any)
      .update({
        full_name: edit.full_name?.trim() || null,
        phone: edit.phone?.trim() || null,
        email: edit.email?.trim() || null,
        bonus_balance: Number(edit.bonus_balance) || 0,
        birth_date: edit.birth_date || null,
        anniversary_date: edit.anniversary_date || null,
      })
      .eq("id", edit.id);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    setEdit(null);
    load();
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Клиенты</h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card label="Всего клиентов" v={filtered.length} />
        <Card label="Сумма покупок" v={`${totalSpent.toLocaleString("ru")} ₽`} />
        <Card label="Средний чек по базе" v={
          filtered.length ? `${Math.round(filtered.reduce((a, r) => a + r.avg_check, 0) / filtered.length)} ₽` : "—"
        } />
        <Card label="Праздники на неделе" v={upcomingHolidays} accent />
      </div>

      <div className="bg-white rounded-3xl p-5">
        <div className="flex gap-2 mb-4 flex-wrap">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени, телефону, email"
            className="flex-1 px-4 py-2 rounded-xl border border-neutral-200 outline-none focus:border-primary min-w-[260px]" />
          <select value={sort} onChange={(e) => setSort(e.target.value as any)}
            className="px-4 py-2 rounded-xl border border-neutral-200">
            <option value="spent">По сумме покупок</option>
            <option value="orders">По кол-ву заказов</option>
            <option value="recent">По последнему заказу</option>
            <option value="holiday">По ближайшему празднику</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500 border-b">
              <tr>
                <th className="py-2">Клиент</th><th>Телефон</th>
                <th>🎂 День рожд.</th><th>💍 Годовщина</th>
                <th className="text-right">Заказов</th>
                <th className="text-right">Потрачено</th>
                <th className="text-right">Ср. чек</th>
                <th className="text-right">Бонусы</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="py-2.5 font-semibold flex items-center gap-2">
                    {r.full_name ?? "—"} {holidayBadge(r.birth_date, r.anniversary_date)}
                  </td>
                  <td className="text-neutral-600">{r.phone ?? "—"}</td>
                  <td className="text-neutral-600">{r.birth_date ? new Date(r.birth_date).toLocaleDateString("ru") : "—"}</td>
                  <td className="text-neutral-600">{r.anniversary_date ? new Date(r.anniversary_date).toLocaleDateString("ru") : "—"}</td>
                  <td className="text-right font-bold">{r.orders_count}</td>
                  <td className="text-right font-bold text-primary">{Number(r.total_spent).toLocaleString("ru")} ₽</td>
                  <td className="text-right">{r.avg_check} ₽</td>
                  <td className="text-right text-amber-600 font-semibold">{Number(r.bonus_balance)}</td>
                  <td className="text-right pl-2">
                    <button onClick={() => setEdit(r)}
                      className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-white transition">
                      ✏️ Редактировать
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={9} className="py-10 text-center text-neutral-400">Клиентов пока нет</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold mb-1">{edit.full_name ?? "Клиент"}</h2>
            <div className="text-sm text-neutral-500 mb-5">{edit.phone ?? "—"} · {edit.email ?? "—"}</div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <Field label="Имя">
                <input value={edit.full_name ?? ""} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200" />
              </Field>
              <Field label="Телефон">
                <input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200" />
              </Field>
              <Field label="Email">
                <input type="email" value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="🎂 День рождения">
                  <input type="date" value={edit.birth_date ?? ""} onChange={(e) => setEdit({ ...edit, birth_date: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200" />
                </Field>
                <Field label="💍 Годовщина">
                  <input type="date" value={edit.anniversary_date ?? ""} onChange={(e) => setEdit({ ...edit, anniversary_date: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-neutral-200" />
                </Field>
              </div>
              <Field label="Бонусы">
                <input min="0" placeholder="0" type="number" step="1" value={(edit.bonus_balance ?? 0) || ""} onChange={(e) => setEdit({ ...edit, bonus_balance: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-xl border border-neutral-200" />
              </Field>

              <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
                Скидка применяется автоматически ±7 дней от даты:<br />
                • Доставка — <b>10%</b> · Самовывоз — <b>15%</b>
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button onClick={() => setEdit(null)} className="px-5 py-2 rounded-full bg-neutral-100 font-semibold text-sm">Отмена</button>
              <button onClick={saveEdit} className="px-5 py-2 rounded-full bg-primary text-white font-semibold text-sm">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, v, accent }: { label: string; v: any; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? "bg-gradient-to-br from-pink-500 to-purple-500 text-white" : "bg-white"}`}>
      <div className={`text-xs uppercase mb-1 ${accent ? "text-white/80" : "text-neutral-500"}`}>{label}</div>
      <div className="text-2xl font-extrabold">{v}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      {children}
    </label>
  );
}
