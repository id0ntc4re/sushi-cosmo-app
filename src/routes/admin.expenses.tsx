import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/expenses")({
  head: () => ({ meta: [{ title: "Прочие расходы — КосмоСуши" }] }),
  component: Expenses,
});

const CATS: { value: string; label: string }[] = [
  { value: "wages", label: "💰 Зарплата" },
  { value: "products", label: "🛒 Закупка продуктов" },
  { value: "rent", label: "🏠 Аренда" },
  { value: "utilities", label: "💡 Коммуналка" },
  { value: "other", label: "📌 Другое" },
];

function Expenses() {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [isSuper, setIsSuper] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "month" | "today">("month");
  const [draft, setDraft] = useState({
    category: "wages",
    amount: 0,
    note: "",
    spent_at: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roles } = await supabase.from("user_roles").select("role,branch_id").eq("user_id", user.id);
      const sup = (roles ?? []).some((r: any) => r.role === "super_admin");
      const adm = (roles ?? []).find((r: any) => r.role === "admin");
      setIsSuper(sup);
      const { data: b } = await supabase.from("branches").select("id,name").eq("is_active", true).order("sort_order");
      setBranches(b ?? []);
      setBranchId(sup ? (b?.[0]?.id ?? "") : (adm?.branch_id ?? ""));
    })();
  }, []);

  async function load() {
    if (!branchId) return;
    let q = supabase.from("expenses").select("*").eq("branch_id", branchId).order("spent_at", { ascending: false }).limit(500);
    if (filter === "today") {
      q = q.eq("spent_at", new Date().toISOString().slice(0, 10));
    } else if (filter === "month") {
      const d = new Date(); d.setDate(1);
      q = q.gte("spent_at", d.toISOString().slice(0, 10));
    }
    const { data } = await q;
    setList(data ?? []);
  }
  useEffect(() => { load(); }, [branchId, filter]);

  async function add() {
    if (!draft.amount) return toast.error("Введите сумму");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({
      branch_id: branchId,
      category: draft.category,
      amount: draft.amount,
      note: draft.note || null,
      spent_at: draft.spent_at,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Расход добавлен");
    setDraft({ ...draft, amount: 0, note: "" });
    load();
  }

  async function del(id: string) {
    if (!confirm("Удалить расход?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    load();
  }

  const totals = useMemo(() => {
    const sum = list.reduce((s, e) => s + Number(e.amount), 0);
    const byCat = CATS.map((c) => ({
      ...c,
      sum: list.filter((e) => e.category === c.value).reduce((s, e) => s + Number(e.amount), 0),
    }));
    return { sum, byCat };
  }, [list]);

  const catLabel = (v: string) => CATS.find((c) => c.value === v)?.label ?? v;

  if (!branchId) return <div className="text-neutral-500">Загрузка…</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold">Прочие расходы</h1>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!isSuper}
          className="ml-auto px-4 py-2 rounded-xl border bg-white text-sm font-semibold">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-3xl p-5 mb-5">
        <h2 className="font-extrabold mb-3">Добавить расход</h2>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="px-3 py-2 rounded-xl border sm:col-span-2">
            {CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input min="0" type="number" placeholder="Сумма ₽" value={(draft.amount || "") || ""} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} className="px-3 py-2 rounded-xl border" />
          <input type="date" value={draft.spent_at} onChange={(e) => setDraft({ ...draft, spent_at: e.target.value })} className="px-3 py-2 rounded-xl border" />
          <input placeholder="Комментарий" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="px-3 py-2 rounded-xl border" />
          <button onClick={add} className="px-4 py-2 rounded-xl bg-primary text-white font-bold">Добавить</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <div className="bg-white rounded-2xl p-4">
          <div className="text-xs text-neutral-500">Итого за период</div>
          <div className="text-xl font-extrabold">{totals.sum.toLocaleString("ru-RU")} ₽</div>
        </div>
        {totals.byCat.map((c) => (
          <div key={c.value} className="bg-white rounded-2xl p-4">
            <div className="text-xs text-neutral-500 truncate">{c.label}</div>
            <div className="text-lg font-extrabold">{c.sum.toLocaleString("ru-RU")} ₽</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {(["today", "month", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold ${filter === f ? "bg-primary text-white" : "bg-neutral-100"}`}>
              {f === "today" ? "Сегодня" : f === "month" ? "Этот месяц" : "Все"}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500 uppercase">
              <tr><th className="py-2">Дата</th><th>Категория</th><th>Сумма</th><th>Комментарий</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="py-2 text-neutral-500">{e.spent_at}</td>
                  <td>{catLabel(e.category)}</td>
                  <td className="font-bold">{Number(e.amount).toLocaleString("ru-RU")} ₽</td>
                  <td className="text-neutral-500">{e.note}</td>
                  <td className="text-right">
                    <button onClick={() => del(e.id)} className="text-red-600 hover:underline text-xs">Удалить</button>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={5} className="py-6 text-center text-neutral-500">Нет записей</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
