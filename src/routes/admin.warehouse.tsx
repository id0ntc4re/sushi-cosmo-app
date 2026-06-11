import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/warehouse")({
  head: () => ({ meta: [{ title: "Склад по филиалам — КосмоСуши" }] }),
  component: Warehouse,
});

type Branch = { id: string; name: string };
type Ingredient = { id: string; name: string; unit: string };

function Warehouse() {
  const [tab, setTab] = useState<"stock" | "products" | "transfers" | "writeoffs" | "inventory" | "schedules">("stock");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isSuper, setIsSuper] = useState(false);
  const [userBranch, setUserBranch] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roles } = await supabase.from("user_roles").select("role,branch_id").eq("user_id", user.id);
      const sup = (roles ?? []).some((r: any) => r.role === "super_admin");
      const adm = (roles ?? []).find((r: any) => r.role === "admin");
      setIsSuper(sup);
      setUserBranch(adm?.branch_id ?? null);

      const { data: b } = await supabase.from("branches").select("id,name").eq("is_active", true).order("sort_order");
      setBranches(b ?? []);
      const initBranch = sup ? (b?.[0]?.id ?? "") : (adm?.branch_id ?? "");
      setBranchId(initBranch);

      const { data: ing } = await supabase.from("ingredients").select("id,name,unit").order("name");
      setIngredients(ing ?? []);
    })();
  }, []);

  if (!branchId) {
    return <div className="text-neutral-500">Загрузка…</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold">Склад по филиалам</h1>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          disabled={!isSuper}
          className="ml-auto px-4 py-2 rounded-xl border bg-white text-sm font-semibold"
        >
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto">
        <Tab on={tab === "stock"} onClick={() => setTab("stock")}>📦 Остатки</Tab>
        <Tab on={tab === "transfers"} onClick={() => setTab("transfers")}>🔁 Перемещения</Tab>
        <Tab on={tab === "writeoffs"} onClick={() => setTab("writeoffs")}>🗑️ Списания</Tab>
        <Tab on={tab === "inventory"} onClick={() => setTab("inventory")}>📋 Инвентаризация</Tab>
      </div>

      {tab === "stock" && <StockTab branchId={branchId} ingredients={ingredients} />}
      {tab === "transfers" && <TransfersTab branchId={branchId} branches={branches} ingredients={ingredients} isSuper={isSuper} userBranch={userBranch} />}
      {tab === "writeoffs" && <WriteoffsTab branchId={branchId} ingredients={ingredients} />}
      {tab === "inventory" && <InventoryTab branchId={branchId} ingredients={ingredients} />}
    </div>
  );
}

function Tab({ on, ...p }: any) {
  return <button {...p} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${on ? "bg-primary text-white" : "bg-white"}`} />;
}

/* ---------- STOCK ---------- */
function StockTab({ branchId, ingredients }: { branchId: string; ingredients: Ingredient[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    const { data } = await supabase
      .from("branch_stock")
      .select("*")
      .eq("branch_id", branchId);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [branchId]);

  const byIng = useMemo(() => {
    const map = new Map(rows.map((r) => [r.ingredient_id, r]));
    return ingredients
      .filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
      .map((i) => ({ ...i, row: map.get(i.id) }));
  }, [rows, ingredients, q]);

  async function upsert(ingredient_id: string, patch: any) {
    const existing = rows.find((r) => r.ingredient_id === ingredient_id);
    if (existing) {
      const { error } = await supabase.from("branch_stock").update(patch).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("branch_stock").insert({ branch_id: branchId, ingredient_id, ...patch });
      if (error) return toast.error(error.message);
    }
    load();
  }

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5">
      <input
        value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Поиск ингредиента"
        className="w-full mb-4 px-4 py-2 rounded-xl border"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-neutral-500 uppercase">
            <tr><th className="py-2">Ингредиент</th><th>Ед.</th><th>Остаток</th><th>Мин. остаток</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {byIng.map((i) => {
              const stock = Number(i.row?.stock ?? 0);
              const min = Number(i.row?.min_stock ?? 0);
              const low = min > 0 && stock < min;
              return (
                <tr key={i.id} className="border-t">
                  <td className="py-2 font-semibold">{i.name}</td>
                  <td className="text-neutral-500">{i.unit}</td>
                  <td>
                    <input type="number" defaultValue={stock}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== stock) upsert(i.id, { stock: v }); }}
                      className="w-24 px-2 py-1.5 rounded-lg border" />
                  </td>
                  <td>
                    <input type="number" defaultValue={min}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== min) upsert(i.id, { min_stock: v }); }}
                      className="w-24 px-2 py-1.5 rounded-lg border" />
                  </td>
                  <td>{low ? <span className="text-red-600 font-bold">⚠️ Низкий</span> : <span className="text-green-600">OK</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- TRANSFERS ---------- */
function TransfersTab({ branchId, branches, ingredients, isSuper, userBranch }: any) {
  const [list, setList] = useState<any[]>([]);
  const [draft, setDraft] = useState({ to_branch_id: "", ingredient_id: "", qty: 0, note: "" });

  async function load() {
    const { data } = await supabase
      .from("stock_transfers")
      .select("*")
      .or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    setList(data ?? []);
  }
  useEffect(() => { load(); }, [branchId]);

  async function create() {
    if (!draft.to_branch_id || !draft.ingredient_id || !draft.qty) return toast.error("Заполните филиал, продукт и количество");
    if (draft.to_branch_id === branchId) return toast.error("Филиал-получатель должен отличаться");
    const { data: { user } } = await supabase.auth.getUser();
    // 1. insert transfer
    const { error } = await supabase.from("stock_transfers").insert({
      from_branch_id: branchId,
      to_branch_id: draft.to_branch_id,
      ingredient_id: draft.ingredient_id,
      qty: draft.qty,
      note: draft.note || null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);

    // 2. adjust stocks on both sides
    await adjustStock(branchId, draft.ingredient_id, -Number(draft.qty));
    await adjustStock(draft.to_branch_id, draft.ingredient_id, Number(draft.qty));

    toast.success("Перемещение оформлено");
    setDraft({ to_branch_id: "", ingredient_id: "", qty: 0, note: "" });
    load();
  }

  const branchName = (id: string) => branches.find((b: Branch) => b.id === id)?.name ?? id.slice(0, 6);
  const ingName = (id: string) => ingredients.find((i: Ingredient) => i.id === id)?.name ?? id.slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-3xl p-5">
        <h2 className="font-extrabold mb-3">Новое перемещение из «{branchName(branchId)}»</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <select value={draft.to_branch_id} onChange={(e) => setDraft({ ...draft, to_branch_id: e.target.value })} className="px-3 py-2 rounded-xl border">
            <option value="">Куда (филиал)</option>
            {branches.filter((b: Branch) => b.id !== branchId).map((b: Branch) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={draft.ingredient_id} onChange={(e) => setDraft({ ...draft, ingredient_id: e.target.value })} className="px-3 py-2 rounded-xl border">
            <option value="">Продукт</option>
            {ingredients.map((i: Ingredient) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
          <input type="number" placeholder="Кол-во" value={draft.qty || ""} onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) })} className="px-3 py-2 rounded-xl border" />
          <input placeholder="Комментарий" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="px-3 py-2 rounded-xl border" />
          <button onClick={create} className="px-4 py-2 rounded-xl bg-primary text-white font-bold">Переместить</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5">
        <h2 className="font-extrabold mb-3">История перемещений</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500 uppercase">
              <tr><th className="py-2">Дата</th><th>Откуда</th><th>Куда</th><th>Продукт</th><th>Кол-во</th><th>Комментарий</th></tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-2 text-neutral-500">{new Date(t.created_at).toLocaleString("ru-RU")}</td>
                  <td>{branchName(t.from_branch_id)}</td>
                  <td>{branchName(t.to_branch_id)}</td>
                  <td>{ingName(t.ingredient_id)}</td>
                  <td className="font-bold">{t.qty}</td>
                  <td className="text-neutral-500">{t.note}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="py-6 text-center text-neutral-500">Нет записей</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function adjustStock(branch_id: string, ingredient_id: string, delta: number) {
  const { data } = await supabase
    .from("branch_stock")
    .select("*")
    .eq("branch_id", branch_id)
    .eq("ingredient_id", ingredient_id)
    .maybeSingle();
  if (data) {
    await supabase.from("branch_stock").update({ stock: Number(data.stock) + delta }).eq("id", data.id);
  } else {
    await supabase.from("branch_stock").insert({ branch_id, ingredient_id, stock: delta });
  }
}

/* ---------- WRITEOFFS ---------- */
function WriteoffsTab({ branchId, ingredients }: { branchId: string; ingredients: Ingredient[] }) {
  const [list, setList] = useState<any[]>([]);
  const [draft, setDraft] = useState({ ingredient_id: "", qty: 0, reason: "" });

  async function load() {
    const { data } = await supabase
      .from("stock_writeoffs")
      .select("*")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(100);
    setList(data ?? []);
  }
  useEffect(() => { load(); }, [branchId]);

  async function create() {
    if (!draft.ingredient_id || !draft.qty) return toast.error("Заполните продукт и количество");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("stock_writeoffs").insert({
      branch_id: branchId,
      ingredient_id: draft.ingredient_id,
      qty: draft.qty,
      reason: draft.reason || null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    await adjustStock(branchId, draft.ingredient_id, -Number(draft.qty));
    toast.success("Списано");
    setDraft({ ingredient_id: "", qty: 0, reason: "" });
    load();
  }

  const ingName = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id.slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-3xl p-5">
        <h2 className="font-extrabold mb-3">Новое списание</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <select value={draft.ingredient_id} onChange={(e) => setDraft({ ...draft, ingredient_id: e.target.value })} className="px-3 py-2 rounded-xl border">
            <option value="">Продукт</option>
            {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
          <input type="number" placeholder="Кол-во" value={draft.qty || ""} onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) })} className="px-3 py-2 rounded-xl border" />
          <input placeholder="Причина (порча, брак…)" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className="px-3 py-2 rounded-xl border" />
          <button onClick={create} className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold">Списать</button>
        </div>
      </div>
      <div className="bg-white rounded-3xl p-5">
        <h2 className="font-extrabold mb-3">История списаний</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500 uppercase">
              <tr><th className="py-2">Дата</th><th>Продукт</th><th>Кол-во</th><th>Причина</th></tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} className="border-t">
                  <td className="py-2 text-neutral-500">{new Date(w.created_at).toLocaleString("ru-RU")}</td>
                  <td>{ingName(w.ingredient_id)}</td>
                  <td className="font-bold">{w.qty}</td>
                  <td className="text-neutral-500">{w.reason}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={4} className="py-6 text-center text-neutral-500">Нет записей</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- INVENTORY ---------- */
function InventoryTab({ branchId, ingredients }: { branchId: string; ingredients: Ingredient[] }) {
  const [stock, setStock] = useState<Map<string, number>>(new Map());
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [note, setNote] = useState("");

  async function load() {
    const { data } = await supabase.from("branch_stock").select("ingredient_id,stock").eq("branch_id", branchId);
    setStock(new Map((data ?? []).map((r: any) => [r.ingredient_id, Number(r.stock)])));
    const { data: h } = await supabase.from("inventory_counts").select("*").eq("branch_id", branchId).order("created_at", { ascending: false }).limit(50);
    setHistory(h ?? []);
  }
  useEffect(() => { load(); }, [branchId]);

  async function save() {
    const entries = Object.entries(counted).filter(([, v]) => v !== "" && v !== undefined);
    if (!entries.length) return toast.error("Введите данные хотя бы по одному продукту");
    const { data: { user } } = await supabase.auth.getUser();
    const rows = entries.map(([ingredient_id, val]) => {
      const c = Number(val);
      const exp = stock.get(ingredient_id) ?? 0;
      return {
        branch_id: branchId,
        ingredient_id,
        counted: c,
        expected: exp,
        diff: c - exp,
        note: note || null,
        created_by: user?.id ?? null,
      };
    });
    const { error } = await supabase.from("inventory_counts").insert(rows);
    if (error) return toast.error(error.message);
    // sync stock to counted
    for (const r of rows) {
      await adjustStock(branchId, r.ingredient_id, r.counted - r.expected);
    }
    toast.success("Инвентаризация сохранена");
    setCounted({});
    setNote("");
    load();
  }

  const ingName = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id.slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-3xl p-5">
        <h2 className="font-extrabold mb-3">Провести инвентаризацию</h2>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500 uppercase">
              <tr><th className="py-2">Продукт</th><th>В системе</th><th>Фактически</th><th>Расхождение</th></tr>
            </thead>
            <tbody>
              {ingredients.map((i) => {
                const exp = stock.get(i.id) ?? 0;
                const c = counted[i.id];
                const diff = c !== undefined && c !== "" ? Number(c) - exp : null;
                return (
                  <tr key={i.id} className="border-t">
                    <td className="py-2 font-semibold">{i.name} <span className="text-neutral-500 font-normal">({i.unit})</span></td>
                    <td>{exp}</td>
                    <td>
                      <input type="number" value={c ?? ""} onChange={(e) => setCounted({ ...counted, [i.id]: e.target.value })}
                        className="w-24 px-2 py-1.5 rounded-lg border" />
                    </td>
                    <td className={diff == null ? "text-neutral-400" : diff === 0 ? "text-green-600 font-bold" : diff < 0 ? "text-red-600 font-bold" : "text-amber-600 font-bold"}>
                      {diff == null ? "—" : (diff > 0 ? "+" : "") + diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <input placeholder="Комментарий к инвентаризации" value={note} onChange={(e) => setNote(e.target.value)} className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border" />
          <button onClick={save} className="px-5 py-2 rounded-xl bg-primary text-white font-bold">Сохранить и обновить остатки</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5">
        <h2 className="font-extrabold mb-3">История инвентаризаций</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500 uppercase">
              <tr><th className="py-2">Дата</th><th>Продукт</th><th>Факт</th><th>Ожидалось</th><th>Расхождение</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="py-2 text-neutral-500">{new Date(h.created_at).toLocaleString("ru-RU")}</td>
                  <td>{ingName(h.ingredient_id)}</td>
                  <td>{h.counted}</td>
                  <td>{h.expected}</td>
                  <td className={h.diff === 0 ? "text-green-600 font-bold" : h.diff < 0 ? "text-red-600 font-bold" : "text-amber-600 font-bold"}>
                    {h.diff > 0 ? "+" : ""}{h.diff}
                  </td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={5} className="py-6 text-center text-neutral-500">Нет записей</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
