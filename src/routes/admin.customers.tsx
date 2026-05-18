import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/customers")({ component: Customers });

type Row = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  bonus_balance: number;
  total_spent: number;
  created_at: string;
  orders_count: number;
  last_order: string | null;
  avg_check: number;
};

function Customers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"spent" | "orders" | "recent">("spent");

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase.from("profiles")
        .select("id,full_name,phone,email,bonus_balance,total_spent,created_at");
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
    })();
  }, []);

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
      return (b.last_order ?? "").localeCompare(a.last_order ?? "");
    });
  }, [rows, q, sort]);

  const totalSpent = filtered.reduce((a, r) => a + Number(r.total_spent), 0);

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Клиенты</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card label="Всего клиентов" v={filtered.length} />
        <Card label="Сумма покупок" v={`${totalSpent.toLocaleString("ru")} ₽`} />
        <Card label="Средний чек по базе" v={
          filtered.length ? `${Math.round(filtered.reduce((a, r) => a + r.avg_check, 0) / filtered.length)} ₽` : "—"
        } />
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
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500 border-b">
              <tr>
                <th className="py-2">Клиент</th><th>Телефон</th><th>Email</th>
                <th className="text-right">Заказов</th>
                <th className="text-right">Потрачено</th>
                <th className="text-right">Ср. чек</th>
                <th className="text-right">Бонусы</th>
                <th>Последний</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="py-2.5 font-semibold">{r.full_name ?? "—"}</td>
                  <td className="text-neutral-600">{r.phone ?? "—"}</td>
                  <td className="text-neutral-500 truncate max-w-[180px]">{r.email ?? "—"}</td>
                  <td className="text-right font-bold">{r.orders_count}</td>
                  <td className="text-right font-bold text-primary">{Number(r.total_spent).toLocaleString("ru")} ₽</td>
                  <td className="text-right">{r.avg_check} ₽</td>
                  <td className="text-right text-amber-600 font-semibold">{Number(r.bonus_balance)}</td>
                  <td className="text-neutral-500">{r.last_order ? new Date(r.last_order).toLocaleDateString("ru") : "—"}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={8} className="py-10 text-center text-neutral-400">Клиентов пока нет</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, v }: { label: string; v: any }) {
  return (
    <div className="bg-white rounded-2xl p-5">
      <div className="text-xs uppercase text-neutral-500 mb-1">{label}</div>
      <div className="text-2xl font-extrabold">{v}</div>
    </div>
  );
}
