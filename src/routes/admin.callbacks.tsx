import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole, branchName as bn } from "@/lib/admin-role";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/callbacks")({
  head: () => ({ meta: [{ title: "Заявки на звонок — Админ" }] }),
  component: CallbacksPage,
});

type Row = {
  id: string; name: string; phone: string; status: string;
  branch_id: string | null; created_at: string; comment: string | null;
};

function CallbacksPage() {
  const { branches, isSuper, branchId, loading: roleLoading } = useAdminRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = supabase.from("callback_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (!isSuper && branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => { if (!roleLoading) load(); /* eslint-disable-next-line */ }, [roleLoading, isSuper, branchId]);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("callback_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, status } : r));
  }

  async function remove(id: string) {
    if (!confirm("Удалить заявку?")) return;
    const { error } = await supabase.from("callback_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Заявки на звонок</h1>
          <p className="text-sm text-neutral-500">Новые заявки приходят в реальном времени.</p>
        </div>
        <button onClick={load} className="h-9 px-3 text-sm rounded-full border hover:bg-neutral-100">Обновить</button>
      </div>

      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Когда</th>
              <th className="text-left px-4 py-3">Имя</th>
              <th className="text-left px-4 py-3">Телефон</th>
              {isSuper && <th className="text-left px-4 py-3">Филиал</th>}
              <th className="text-left px-4 py-3">Статус</th>
              <th className="text-right px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">Загрузка…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">Пока нет заявок</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 whitespace-nowrap text-neutral-500">{new Date(r.created_at).toLocaleString("ru-RU")}</td>
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3"><a className="text-primary hover:underline" href={`tel:${r.phone}`}>{r.phone}</a></td>
                {isSuper && <td className="px-4 py-3">{bn(branches, r.branch_id)}</td>}
                <td className="px-4 py-3">
                  <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold border ${
                      r.status === "new" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      r.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-neutral-50 text-neutral-600 border-neutral-200"
                    }`}>
                    <option value="new">Новая</option>
                    <option value="in_progress">В работе</option>
                    <option value="done">Готово</option>
                    <option value="cancelled">Отменена</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(r.id)} className="text-xs text-red-600 hover:underline">Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
