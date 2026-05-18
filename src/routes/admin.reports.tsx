import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/reports")({ component: Reports });

function Reports() {
  const [days, setDays] = useState(7);
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0, 0, 0, 0);
      const { data: o } = await supabase.from("orders")
        .select("id,total,status,payment_method,delivery_type,created_at")
        .is("deleted_at", null)
        .gte("created_at", since.toISOString())
        .neq("status", "cancelled");
      setOrders(o ?? []);
      const ids = (o ?? []).map((x: any) => x.id);
      if (ids.length) {
        const { data: it } = await supabase.from("order_items").select("name,quantity,total").in("order_id", ids);
        setItems(it ?? []);
      } else setItems([]);
    })();
  }, [days]);

  const stats = useMemo(() => {
    const sum = orders.reduce((a, o) => a + Number(o.total), 0);
    const avg = orders.length ? Math.round(sum / orders.length) : 0;
    const cash = orders.filter((o) => o.payment_method === "cash").reduce((a, o) => a + Number(o.total), 0);
    const card = sum - cash;
    const delivery = orders.filter((o) => o.delivery_type === "delivery").length;
    const pickup = orders.length - delivery;

    // by day
    const byDay: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      byDay[d.toISOString().slice(0, 10)] = 0;
    }
    orders.forEach((o) => {
      const k = o.created_at.slice(0, 10);
      if (k in byDay) byDay[k] += Number(o.total);
    });

    // by hour
    const byHour: number[] = Array(24).fill(0);
    orders.forEach((o) => { byHour[new Date(o.created_at).getHours()]++; });

    // top items
    const top: Record<string, { qty: number; sum: number }> = {};
    items.forEach((i) => {
      const r = top[i.name] ??= { qty: 0, sum: 0 };
      r.qty += i.quantity; r.sum += Number(i.total);
    });
    const topList = Object.entries(top).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 10);

    return { sum, avg, cash, card, delivery, pickup, byDay, byHour, topList };
  }, [orders, items, days]);

  const maxDay = Math.max(...Object.values(stats.byDay), 1);
  const maxHour = Math.max(...stats.byHour, 1);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold">Отчёты</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="px-4 py-2 rounded-xl border bg-white">
          <option value={1}>Сегодня</option>
          <option value={7}>7 дней</option>
          <option value={30}>30 дней</option>
          <option value={90}>90 дней</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card label="Заказов" v={orders.length} />
        <Card label="Выручка" v={`${stats.sum.toLocaleString("ru")} ₽`} accent />
        <Card label="Средний чек" v={`${stats.avg} ₽`} />
        <Card label="Доставка / Самовывоз" v={`${stats.delivery} / ${stats.pickup}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-3xl p-5">
          <h3 className="font-extrabold mb-4">Выручка по дням</h3>
          <div className="space-y-2">
            {Object.entries(stats.byDay).map(([d, v]) => (
              <div key={d} className="flex items-center gap-3 text-sm">
                <div className="w-20 text-neutral-500">{d.slice(5)}</div>
                <div className="flex-1 bg-neutral-100 rounded-full h-6 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full"
                    style={{ width: `${(v / maxDay) * 100}%` }} />
                </div>
                <div className="w-24 text-right font-bold">{v.toLocaleString("ru")} ₽</div>
              </div>
            ))}
          </div>
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

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-3xl p-5">
          <h3 className="font-extrabold mb-4">Способы оплаты</h3>
          <Bar label="💵 Наличные" v={stats.cash} max={stats.sum} />
          <Bar label="💳 Картой / онлайн" v={stats.card} max={stats.sum} />
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
