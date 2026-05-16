import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminRole, branchName } from "@/lib/admin-role";

export const Route = createFileRoute("/admin/shifts")({ component: Shifts });

function Shifts() {
  const { isSuper, branchId: myBranchId, branches, loading: roleLoading } = useAdminRole();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [openShift, setOpenShift] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [openCash, setOpenCash] = useState(0);
  const [closeCash, setCloseCash] = useState(0);
  const [stats, setStats] = useState<{ cash: number; card: number; count: number; total: number } | null>(null);

  // For super-admin: aggregated open shifts across all branches
  const [allOpen, setAllOpen] = useState<any[]>([]);

  const effectiveBranch = isSuper ? selectedBranch : myBranchId;

  useEffect(() => {
    if (!isSuper && myBranchId) setSelectedBranch(myBranchId);
    else if (isSuper && branches.length && !selectedBranch) setSelectedBranch(branches[0]?.id ?? "");
  }, [isSuper, myBranchId, branches]);

  async function load() {
    if (isSuper) {
      const { data: all } = await supabase.from("cash_shifts").select("*").is("closed_at", null);
      setAllOpen(all ?? []);
    }
    if (!effectiveBranch) { setOpenShift(null); setHistory([]); return; }
    const { data: o } = await supabase.from("cash_shifts")
      .select("*").eq("branch_id", effectiveBranch).is("closed_at", null)
      .order("opened_at", { ascending: false }).limit(1).maybeSingle();
    setOpenShift(o ?? null);
    if (o) {
      const { data: orders } = await supabase.from("orders")
        .select("total,payment_method,status").eq("shift_id", o.id).neq("status", "cancelled");
      const cash = (orders ?? []).filter((x: any) => x.payment_method === "cash").reduce((a: number, x: any) => a + Number(x.total), 0);
      const card = (orders ?? []).filter((x: any) => x.payment_method !== "cash").reduce((a: number, x: any) => a + Number(x.total), 0);
      setStats({ cash, card, count: (orders ?? []).length, total: cash + card });
    } else setStats(null);
    const hq = supabase.from("cash_shifts").select("*").not("closed_at", "is", null)
      .order("closed_at", { ascending: false }).limit(30);
    const { data: h } = isSuper ? await hq : await hq.eq("branch_id", effectiveBranch);
    setHistory(h ?? []);
  }

  useEffect(() => { if (!roleLoading) load(); }, [roleLoading, effectiveBranch, isSuper]);

  async function openNewShift() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!effectiveBranch) return toast.error("Выберите филиал");
    const { error } = await supabase.from("cash_shifts").insert({
      opened_by: user.id, opening_cash: openCash, branch_id: effectiveBranch,
    });
    if (error) return toast.error(error.message);
    toast.success("Смена открыта"); setOpenCash(0); load();
  }
  async function closeShift() {
    if (!openShift) return;
    const { error } = await supabase.from("cash_shifts").update({
      closed_at: new Date().toISOString(), closing_cash: closeCash,
      cash_total: stats?.cash ?? 0, card_total: stats?.card ?? 0, orders_count: stats?.count ?? 0,
    }).eq("id", openShift.id);
    if (error) return toast.error(error.message);
    toast.success("Смена закрыта"); setCloseCash(0); load();
  }

  if (roleLoading) return <div className="text-neutral-500">Загрузка…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold">Кассовые смены</h1>
        {isSuper && (
          <label className="flex items-center gap-2">
            <span className="text-sm font-semibold">Филиал:</span>
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 rounded-xl border bg-white font-semibold">
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {isSuper && (
        <div className="bg-white rounded-3xl p-5 mb-6">
          <h3 className="font-extrabold mb-3">Открытые смены по всем филиалам</h3>
          {allOpen.length === 0 && <div className="text-sm text-neutral-400">Нет открытых смен</div>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allOpen.map((o) => (
              <div key={o.id} className="rounded-2xl border p-3">
                <div className="text-sm text-neutral-500">{branchName(branches, o.branch_id)}</div>
                <div className="font-extrabold">{new Date(o.opened_at).toLocaleString("ru")}</div>
                <div className="text-xs text-green-600 font-bold mt-1">● Открыта</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {openShift ? (
        <div className="bg-white rounded-3xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-sm text-neutral-500">Смена · {branchName(branches, openShift.branch_id)}</div>
              <div className="text-2xl font-extrabold">{new Date(openShift.opened_at).toLocaleString("ru")}</div>
              <div className="text-sm text-neutral-500 mt-1">Открыто наличными: <b>{Number(openShift.opening_cash)} ₽</b></div>
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
              Расхождение: <b className={closeCash - Number(openShift.opening_cash) - (stats?.cash ?? 0) === 0 ? "text-green-600" : "text-red-600"}>
                {closeCash - Number(openShift.opening_cash) - (stats?.cash ?? 0)} ₽
              </b>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 mb-6">
          <h3 className="font-extrabold mb-3">
            Открыть новую смену{isSuper ? ` · ${branchName(branches, selectedBranch)}` : ""}
          </h3>
          <div className="flex gap-3 items-end">
            <label className="flex-1">
              <span className="text-sm text-neutral-600 block mb-1">Наличные в кассе</span>
              <input type="number" value={openCash} onChange={(e) => setOpenCash(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border" />
            </label>
            <button onClick={openNewShift} className="px-6 py-2.5 rounded-full bg-primary text-white font-bold">Открыть смену</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6">
        <h3 className="font-extrabold mb-4">История смен {isSuper ? "(все филиалы)" : ""}</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500 border-b">
            <tr>
              {isSuper && <th className="py-2">Филиал</th>}
              <th className="py-2">Открыта</th><th>Закрыта</th><th>Заказов</th><th>Наличные</th><th>Безнал</th><th>Итого</th>
            </tr>
          </thead>
          <tbody>
            {history.map((s) => (
              <tr key={s.id} className="border-b">
                {isSuper && <td className="py-2 font-semibold">{branchName(branches, s.branch_id)}</td>}
                <td className="py-2">{new Date(s.opened_at).toLocaleString("ru")}</td>
                <td>{s.closed_at ? new Date(s.closed_at).toLocaleString("ru") : "—"}</td>
                <td className="font-bold">{s.orders_count}</td>
                <td>{Number(s.cash_total)} ₽</td>
                <td>{Number(s.card_total)} ₽</td>
                <td className="font-bold text-primary">{Number(s.cash_total) + Number(s.card_total)} ₽</td>
              </tr>
            ))}
            {!history.length && <tr><td colSpan={isSuper ? 7 : 6} className="py-8 text-center text-neutral-400">История пуста</td></tr>}
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
