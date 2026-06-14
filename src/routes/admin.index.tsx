import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminRole, branchName } from "@/lib/admin-role";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

type Stats = {
  ordersToday: number;
  revenueToday: number;
  ordersWeek: number;
  newOrders: number;
  productsCount: number;
};

function Dashboard() {
  const { isSuper, branchId, branches, loading } = useAdminRole();
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [s, setS] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (loading) return;
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const week = new Date(); week.setDate(week.getDate() - 7);

      const scopeBranch = isSuper
        ? (filterBranch !== "all" ? filterBranch : null)
        : branchId;

      const apply = (q: any) => {
        let r = q.is("deleted_at", null);
        return scopeBranch ? r.eq("branch_id", scopeBranch) : r;
      };

      const [todayR, weekR, newR, prodR, recentR] = await Promise.all([
        apply(supabase.from("orders").select("total", { count: "exact" }).gte("created_at", today.toISOString())),
        apply(supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", week.toISOString())),
        apply(supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "new")),
        supabase.from("products").select("id", { count: "exact", head: true }),
        apply(supabase.from("orders").select("id,number,customer_name,total,status,created_at,branch_id").order("created_at", { ascending: false }).limit(8)),
      ]);
      setS({
        ordersToday: todayR.count ?? 0,
        revenueToday: (todayR.data ?? []).reduce((a: number, r: any) => a + Number(r.total), 0),
        ordersWeek: weekR.count ?? 0,
        newOrders: newR.count ?? 0,
        productsCount: prodR.count ?? 0,
      });
      setRecent(recentR.data ?? []);
    })();
  }, [loading, isSuper, branchId, filterBranch]);

  const scopeLabel = isSuper
    ? (filterBranch === "all" ? "Все филиалы" : branchName(branches, filterBranch))
    : branchName(branches, branchId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Дашборд</h1>
          <div className="text-sm text-neutral-500 mt-1">Филиал: <span className="font-semibold text-neutral-800">{scopeLabel}</span></div>
        </div>
        {isSuper && (
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-4 py-2 rounded-xl border border-neutral-200 bg-white"
          >
            <option value="all">Все филиалы</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Заказов сегодня" value={s?.ordersToday ?? "—"} />
        <Stat label="Выручка сегодня" value={s ? `${s.revenueToday} ₽` : "—"} accent />
        <Stat label="За 7 дней" value={s?.ordersWeek ?? "—"} />
        <Stat label="Новых" value={s?.newOrders ?? "—"} highlight />
      </div>

      <div className="bg-white rounded-2xl p-4 mb-8 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-bold text-sm">Касса (ККТ)</div>
          <div className="text-xs text-neutral-500">
            Открытие/закрытие смены на онлайн-кассе филиала
            {!isSuper || filterBranch !== "all" ? "" : " — выберите конкретный филиал выше"}
          </div>
        </div>
        <ShiftButtons branchId={isSuper ? (filterBranch !== "all" ? filterBranch : null) : branchId} />
      </div>

      <div className="bg-white rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold">Последние заказы</h2>
          <Link to="/admin/orders" className="text-sm text-primary font-semibold">Все →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500 border-b">
            <tr>
              <th className="py-2">№</th><th>Клиент</th><th>Сумма</th><th>Статус</th>
              {isSuper && <th>Филиал</th>}
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="py-3 font-bold">#{o.number}</td>
                <td>{o.customer_name}</td>
                <td className="font-semibold">{Number(o.total)} ₽</td>
                <td><StatusBadge s={o.status} /></td>
                {isSuper && <td className="text-neutral-600">{branchName(branches, o.branch_id)}</td>}
                <td className="text-neutral-500">{new Date(o.created_at).toLocaleString("ru")}</td>
              </tr>
            ))}
            {!recent.length && <tr><td colSpan={isSuper ? 6 : 5} className="py-8 text-center text-neutral-400">Заказов пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, highlight }: { label: string; value: any; accent?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? "bg-gradient-to-br from-primary to-orange-500 text-white" : highlight ? "bg-neutral-900 text-white" : "bg-white"}`}>
      <div className={`text-xs uppercase tracking-wider mb-2 ${accent || highlight ? "opacity-80" : "text-neutral-500"}`}>{label}</div>
      <div className="text-3xl font-extrabold">{value}</div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  confirmed: "bg-purple-100 text-purple-700",
  cooking: "bg-amber-100 text-amber-700",
  delivering: "bg-cyan-100 text-cyan-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Новый", confirmed: "Подтверждён", cooking: "Готовится",
  delivering: "Доставляется", done: "Выполнен", cancelled: "Отменён",
};
function StatusBadge({ s }: { s: string }) {
  return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[s] ?? "bg-neutral-100"}`}>{STATUS_LABEL[s] ?? s}</span>;
}

function ShiftButtons({ branchId }: { branchId: string | null | undefined }) {
  const [busy, setBusy] = useState<null | "openShift" | "closeShift">(null);
  async function run(cmd: "openShift" | "closeShift") {
    if (!branchId) return toast.error("Выберите конкретный филиал — у каждой кассы своя смена");
    setBusy(cmd);
    try {
      const { data: b } = await (supabase.from("branches") as any)
        .select("kkt_url,kkt_operator_name,kkt_operator_inn")
        .eq("id", branchId).maybeSingle();
      if (!b?.kkt_url) {
        toast.error("В настройках филиала не указан адрес драйвера ККТ");
        return;
      }
      const { runShiftCommand } = await import("@/lib/fiscal-print");
      const res = await runShiftCommand(b.kkt_url, b.kkt_operator_name || "Кассир", b.kkt_operator_inn, cmd);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(cmd === "openShift" ? "Смена открыта · отчёт об открытии напечатан" : "Смена закрыта · Z-отчёт напечатан");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="flex gap-2">
      <button onClick={() => run("openShift")} disabled={!!busy || !branchId}
        className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50">
        {busy === "openShift" ? "Открываем…" : "🔓 Открыть смену"}
      </button>
      <button onClick={() => run("closeShift")} disabled={!!busy || !branchId}
        className="px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-bold disabled:opacity-50">
        {busy === "closeShift" ? "Закрываем…" : "🔒 Закрыть смену (Z-отчёт)"}
      </button>
    </div>
  );
}
