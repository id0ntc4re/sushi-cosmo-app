import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/shifts")({ component: Shifts });

function Shifts() {
  const [open, setOpen] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [openCash, setOpenCash] = useState(0);
  const [closeCash, setCloseCash] = useState(0);
  const [stats, setStats] = useState<{ cash: number; card: number; count: number; total: number } | null>(null);

  async function load() {
    const { data: o } = await supabase.from("cash_shifts").select("*").is("closed_at", null).order("opened_at", { ascending: false }).limit(1).maybeSingle();
    setOpen(o ?? null);
    if (o) {
      const { data: orders } = await supabase.from("orders")
        .select("total,payment_method,status")
        .eq("shift_id", o.id).neq("status", "cancelled");
      const cash = (orders ?? []).filter((x: any) => x.payment_method === "cash").reduce((a: number, x: any) => a + Number(x.total), 0);
      const card = (orders ?? []).filter((x: any) => x.payment_method !== "cash").reduce((a: number, x: any) => a + Number(x.total), 0);
      setStats({ cash, card, count: (orders ?? []).length, total: cash + card });
    } else setStats(null);
    const { data: h } = await supabase.from("cash_shifts").select("*").not("closed_at", "is", null).order("closed_at", { ascending: false }).limit(20);
    setHistory(h ?? []);
  }
  useEffect(() => { load(); }, []);

  async function openShift() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("cash_shifts").insert({ opened_by: user.id, opening_cash: openCash });
    if (error) return toast.error(error.message);
    toast.success("Смена открыта");
    setOpenCash(0); load();
  }
  async function closeShift() {
    if (!open) return;
    const { error } = await supabase.from("cash_shifts").update({
      closed_at: new Date().toISOString(),
      closing_cash: closeCash,
      cash_total: stats?.cash ?? 0,
      card_total: stats?.card ?? 0,
      orders_count: stats?.count ?? 0,
    }).eq("id", open.id);
    if (error) return toast.error(error.message);
    toast.success("Смена закрыта");
    setCloseCash(0); load();
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Кассовые смены</h1>

      {open ? (
        <div className="bg-white rounded-3xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-neutral-500">Смена открыта</div>
              <div className="text-2xl font-extrabold">{new Date(open.opened_at).toLocaleString("ru")}</div>
              <div className="text-sm text-neutral-500 mt-1">Открыто наличными: <b>{Number(open.opening_cash)} ₽</b></div>
            </div>
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-bold text-sm">● Открыта</span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5">
            <Stat label="Заказов" v={stats?.count ?? 0} />
            <Stat label="Наличные" v={`${stats?.cash ?? 0} ₽`} />
            <Stat label="Безнал" v={`${stats?.card ?? 0} ₽`} />
            <Stat label="ИТОГО" v={`${stats?.total ?? 0} ₽`} accent />
          </div>

          <div className="border-t pt-4 flex items-end gap-3">
            <label className="flex-1">
              <span className="text-sm text-neutral-600 block mb-1">Наличные на момент закрытия</span>
              <input type="number" value={closeCash} onChange={(e) => setCloseCash(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border" />
            </label>
            <button onClick={closeShift} className="px-6 py-2.5 rounded-full bg-red-500 text-white font-bold">Z-отчёт / Закрыть смену</button>
          </div>
          {closeCash > 0 && (
            <div className="mt-3 text-sm">
              Расхождение: <b className={closeCash - Number(open.opening_cash) - (stats?.cash ?? 0) === 0 ? "text-green-600" : "text-red-600"}>
                {closeCash - Number(open.opening_cash) - (stats?.cash ?? 0)} ₽
              </b>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 mb-6">
          <h3 className="font-extrabold mb-3">Открыть новую смену</h3>
          <div className="flex gap-3 items-end">
            <label className="flex-1">
              <span className="text-sm text-neutral-600 block mb-1">Наличные в кассе</span>
              <input type="number" value={openCash} onChange={(e) => setOpenCash(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border" />
            </label>
            <button onClick={openShift} className="px-6 py-2.5 rounded-full bg-primary text-white font-bold">Открыть смену</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6">
        <h3 className="font-extrabold mb-4">История смен</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500 border-b">
            <tr><th className="py-2">Открыта</th><th>Закрыта</th><th>Заказов</th><th>Наличные</th><th>Безнал</th><th>Итого</th></tr>
          </thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="py-2">{new Date(s.opened_at).toLocaleString("ru")}</td>
                <td>{s.closed_at ? new Date(s.closed_at).toLocaleString("ru") : "—"}</td>
                <td className="font-bold">{s.orders_count}</td>
                <td>{Number(s.cash_total)} ₽</td>
                <td>{Number(s.card_total)} ₽</td>
                <td className="font-bold text-primary">{Number(s.cash_total) + Number(s.card_total)} ₽</td>
              </tr>
            ))}
            {!history.length && <tr><td colSpan={6} className="py-8 text-center text-neutral-400">История пуста</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, v, accent }: any) {
  return (
    <div className={`rounded-2xl p-4 ${accent ? "bg-gradient-to-br from-primary to-orange-500 text-white" : "bg-neutral-50"}`}>
      <div className={`text-xs uppercase mb-1 ${accent ? "opacity-80" : "text-neutral-500"}`}>{label}</div>
      <div className="text-xl font-extrabold">{v}</div>
    </div>
  );
}
