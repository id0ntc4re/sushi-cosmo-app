import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/reports")({ component: Reports });

type Period = "day" | "month" | "year";

function Reports() {
  const [period, setPeriod] = useState<Period>("day");
  const [days, setDays] = useState(7);
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>("all");

  useEffect(() => {
    supabase.from("branches").select("id,name").order("sort_order").then(({ data }) => setBranches(data ?? []));
  }, []);

  useEffect(() => {
    (async () => {
      const since = new Date();
      if (period === "day") since.setDate(since.getDate() - days);
      else if (period === "month") since.setMonth(since.getMonth() - days);
      else since.setFullYear(since.getFullYear() - days);
      since.setHours(0, 0, 0, 0);

      let q = supabase.from("orders")
        .select("id,total,status,payment_method,delivery_type,created_at,branch_id")
        .is("deleted_at", null)
        .gte("created_at", since.toISOString())
        .neq("status", "cancelled");
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);

      const { data: o } = await q;
      setOrders(o ?? []);
      const ids = (o ?? []).map((x: any) => x.id);
      if (ids.length) {
        const { data: it } = await supabase.from("order_items").select("name,quantity,total").in("order_id", ids);
        setItems(it ?? []);
      } else setItems([]);
    })();
  }, [days, period, branchFilter]);

  const fmtKey = (d: Date) => {
    if (period === "day") return d.toISOString().slice(0, 10);
    if (period === "month") return d.toISOString().slice(0, 7);
    return String(d.getFullYear());
  };

  const stats = useMemo(() => {
    const sum = orders.reduce((a, o) => a + Number(o.total), 0);
    const avg = orders.length ? Math.round(sum / orders.length) : 0;
    const cash = orders.filter((o) => o.payment_method === "cash").reduce((a, o) => a + Number(o.total), 0);
    const card = sum - cash;
    const delivery = orders.filter((o) => o.delivery_type === "delivery").length;
    const pickup = orders.length - delivery;

    // by period bucket
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      if (period === "day") d.setDate(d.getDate() - i);
      else if (period === "month") d.setMonth(d.getMonth() - i);
      else d.setFullYear(d.getFullYear() - i);
      buckets[fmtKey(d)] = 0;
    }
    orders.forEach((o) => {
      const d = new Date(o.created_at);
      const k = fmtKey(d);
      if (k in buckets) buckets[k] += Number(o.total);
    });

    // by hour
    const byHour: number[] = Array(24).fill(0);
    orders.forEach((o) => { byHour[new Date(o.created_at).getHours()]++; });

    // by branch
    const byBranch: Record<string, { sum: number; count: number }> = {};
    orders.forEach((o) => {
      const k = o.branch_id ?? "—";
      const r = byBranch[k] ??= { sum: 0, count: 0 };
      r.sum += Number(o.total); r.count++;
    });
    const branchList = Object.entries(byBranch).map(([id, v]) => ({
      id, name: branches.find((b) => b.id === id)?.name ?? "Без филиала", ...v,
    })).sort((a, b) => b.sum - a.sum);

    // top items
    const top: Record<string, { qty: number; sum: number }> = {};
    items.forEach((i) => {
      const r = top[i.name] ??= { qty: 0, sum: 0 };
      r.qty += i.quantity; r.sum += Number(i.total);
    });
    const topList = Object.entries(top).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 10);

    return { sum, avg, cash, card, delivery, pickup, buckets, byHour, topList, branchList };
  }, [orders, items, days, period, branches]);

  const maxBucket = Math.max(...Object.values(stats.buckets), 1);
  const maxHour = Math.max(...stats.byHour, 1);

  const periodLabel = period === "day" ? "дней" : period === "month" ? "месяцев" : "лет";
  const presets = period === "day" ? [1, 7, 14, 30, 90] : period === "month" ? [3, 6, 12, 24] : [1, 3, 5];

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-3xl font-extrabold">Отчёты</h1>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-xl bg-neutral-100 p-1">
            {(["day", "month", "year"] as Period[]).map((p) => (
              <button key={p} onClick={() => { setPeriod(p); setDays(p === "day" ? 7 : p === "month" ? 6 : 3); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${period === p ? "bg-white shadow" : "text-neutral-500"}`}>
                {p === "day" ? "День" : p === "month" ? "Месяц" : "Год"}
              </button>
            ))}
          </div>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="px-4 py-2 rounded-xl border bg-white">
            {presets.map((n) => <option key={n} value={n}>{n} {periodLabel}</option>)}
          </select>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border bg-white">
            <option value="all">Все филиалы</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card label="Заказов" v={orders.length} />
        <Card label="Выручка" v={`${stats.sum.toLocaleString("ru")} ₽`} accent />
        <Card label="Средний чек" v={`${stats.avg} ₽`} />
        <Card label="Доставка / Самовывоз" v={`${stats.delivery} / ${stats.pickup}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-3xl p-5">
          <h3 className="font-extrabold mb-4">
            Выручка по {period === "day" ? "дням" : period === "month" ? "месяцам" : "годам"}
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.buckets).map(([d, v]) => (
              <div key={d} className="flex items-center gap-3 text-sm">
                <div className="w-24 text-neutral-500">{period === "day" ? d.slice(5) : d}</div>
                <div className="flex-1 bg-neutral-100 rounded-full h-6 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full"
                    style={{ width: `${(v / maxBucket) * 100}%` }} />
                </div>
                <div className="w-28 text-right font-bold">{v.toLocaleString("ru")} ₽</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5">
          <h3 className="font-extrabold mb-4">Выручка по филиалам</h3>
          {stats.branchList.length ? (
            <div className="space-y-3">
              {stats.branchList.map((b) => {
                const pct = stats.sum ? (b.sum / stats.sum) * 100 : 0;
                return (
                  <div key={b.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold">{b.name}</span>
                      <span className="font-bold">{b.sum.toLocaleString("ru")} ₽ · {b.count} зак.</span>
                    </div>
                    <div className="bg-neutral-100 rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div className="text-neutral-400 text-sm">Нет данных</div>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-3xl p-5">
          <h3 className="font-extrabold mb-4">Способы оплаты</h3>
          <Bar label="💵 Наличные" v={stats.cash} max={stats.sum} />
          <Bar label="💳 Картой / онлайн" v={stats.card} max={stats.sum} />
        </div>
        <div className="bg-white rounded-3xl p-5">
          <h3 className="font-extrabold mb-4">Заказы по часам</h3>
          <div className="flex items-end gap-1 h-48">
            {stats.byHour.map((v, h) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-neutral-500">{v || ""}</div>
                <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(v / maxHour) * 100}%`, minHeight: v ? 2 : 0 }} />
                <div className="text-[10px] text-neutral-400">{h}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5">
        <h3 className="font-extrabold mb-4">Топ-10 блюд</h3>
        <table className="w-full text-sm">
          <tbody>
            {stats.topList.map((t, i) => (
              <tr key={t.name} className="border-b last:border-0">
                <td className="py-2 text-neutral-400 w-6">{i + 1}</td>
                <td className="font-semibold">{t.name}</td>
                <td className="text-right font-bold">{t.qty} шт</td>
                <td className="text-right text-primary font-bold w-24">{t.sum.toLocaleString("ru")} ₽</td>
              </tr>
            ))}
            {!stats.topList.length && <tr><td className="py-6 text-center text-neutral-400" colSpan={4}>Нет данных</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, v, accent }: any) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? "bg-gradient-to-br from-primary to-orange-500 text-white" : "bg-white"}`}>
      <div className={`text-xs uppercase mb-2 ${accent ? "opacity-80" : "text-neutral-500"}`}>{label}</div>
      <div className="text-2xl font-extrabold">{v}</div>
    </div>
  );
}

function Bar({ label, v, max }: { label: string; v: number; max: number }) {
  const pct = max ? (v / max) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span className="font-bold">{v.toLocaleString("ru")} ₽ ({Math.round(pct)}%)</span>
      </div>
      <div className="bg-neutral-100 rounded-full h-3 overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
