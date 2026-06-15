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
  const [tab, setTab] = useState<"stock" | "products" | "prepared" | "transfers" | "writeoffs" | "inventory" | "schedules">("stock");
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
        <Tab on={tab === "stock"} onClick={() => setTab("stock")}>📦 Остатки ингредиентов</Tab>
        <Tab on={tab === "products"} onClick={() => setTab("products")}>🥤 Готовые товары</Tab>
        <Tab on={tab === "prepared"} onClick={() => setTab("prepared")}>🧪 Заготовки/соусы</Tab>
        <Tab on={tab === "transfers"} onClick={() => setTab("transfers")}>🔁 Перемещения</Tab>
        <Tab on={tab === "writeoffs"} onClick={() => setTab("writeoffs")}>🗑️ Списания</Tab>
        <Tab on={tab === "inventory"} onClick={() => setTab("inventory")}>📋 Инвентаризация</Tab>
        <Tab on={tab === "schedules"} onClick={() => setTab("schedules")}>⏰ Авто-списания</Tab>
      </div>

      {tab === "stock" && <StockTab branchId={branchId} ingredients={ingredients} />}
      {tab === "products" && <ProductStockTab branchId={branchId} />}
      {tab === "prepared" && <PreparedTab ingredients={ingredients} reloadIngredients={async () => {
        const { data: ing } = await supabase.from("ingredients").select("id,name,unit").order("name");
        setIngredients(ing ?? []);
      }} />}
      {tab === "transfers" && <TransfersTab branchId={branchId} branches={branches} ingredients={ingredients} isSuper={isSuper} userBranch={userBranch} />}
      {tab === "writeoffs" && <WriteoffsTab branchId={branchId} ingredients={ingredients} />}
      {tab === "inventory" && <InventoryTab branchId={branchId} ingredients={ingredients} />}
      {tab === "schedules" && <SchedulesTab branches={branches} />}
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
          <input type="number" placeholder="Кол-во" value={(draft.qty || "") || ""} onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) })} className="px-3 py-2 rounded-xl border" />
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
          <input type="number" placeholder="Кол-во" value={(draft.qty || "") || ""} onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) })} className="px-3 py-2 rounded-xl border" />
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

/* ---------- ГОТОВЫЕ ТОВАРЫ (writeoff_mode='self') ---------- */
function ProductStockTab({ branchId }: { branchId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    const [{ data: p }, { data: bs }] = await Promise.all([
      supabase.from("products").select("id,name,unit,writeoff_mode,is_active").eq("writeoff_mode", "self").order("name"),
      supabase.from("branch_product_stock").select("*").eq("branch_id", branchId),
    ]);
    setProducts(p ?? []);
    setRows(bs ?? []);
  }
  useEffect(() => { load(); }, [branchId]);

  const view = useMemo(() => {
    const map = new Map(rows.map((r) => [r.product_id, r]));
    return products
      .map((p) => ({ ...p, ...(map.get(p.id) ?? { stock: 0, min_stock: 0 }) }))
      .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  }, [products, rows, q]);

  async function upsert(product_id: string, patch: any) {
    const existing = rows.find((r) => r.product_id === product_id);
    if (existing) {
      const { error } = await supabase.from("branch_product_stock").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("branch_product_stock").insert({ branch_id: branchId, product_id, ...patch });
      if (error) return toast.error(error.message);
    }
    load();
  }

  return (
    <div className="bg-white rounded-3xl p-5">
      <div className="flex gap-3 mb-4 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Поиск товара" className="px-4 py-2 rounded-xl border border-neutral-200 flex-1" />
        <span className="text-xs text-neutral-500">Только товары с методом списания «Само блюдо»</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-600">
          <tr>
            <th className="p-3">Товар</th>
            <th>Остаток</th>
            <th>Мин. остаток</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {view.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-3 font-semibold">{r.name} {r.unit && <span className="text-xs text-neutral-500">({r.unit})</span>}</td>
              <td>
                <input type="number" step="0.01" defaultValue={r.stock} onBlur={(e) => Number(e.target.value) !== Number(r.stock) && upsert(r.id, { stock: Number(e.target.value) })}
                  className={`px-2 py-1 rounded-lg border w-28 ${Number(r.stock) <= Number(r.min_stock) && Number(r.min_stock) > 0 ? "border-red-300 bg-red-50" : "border-neutral-200"}`} />
              </td>
              <td>
                <input type="number" step="0.01" defaultValue={r.min_stock} onBlur={(e) => Number(e.target.value) !== Number(r.min_stock) && upsert(r.id, { min_stock: Number(e.target.value) })}
                  className="px-2 py-1 rounded-lg border border-neutral-200 w-28" />
              </td>
              <td className="text-right pr-3">
                {Number(r.stock) <= Number(r.min_stock) && Number(r.min_stock) > 0 && <span className="text-xs text-red-600 font-bold">⚠ закончился</span>}
              </td>
            </tr>
          ))}
          {!view.length && <tr><td colSpan={4} className="py-8 text-center text-neutral-400">Нет товаров с методом списания «Само блюдо». Откройте карточку товара и переключите метод.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- АВТО-СПИСАНИЯ ПРОСРОЧКИ ---------- */
function SchedulesTab({ branches }: { branches: Branch[] }) {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({
    name: "", branch_id: "", scope: "category", target_id: "", time_of_day: "23:00",
    days_of_week: [0,1,2,3,4,5,6], active: true,
  });

  async function load() {
    const [{ data: s }, { data: c }, { data: p }, { data: i }] = await Promise.all([
      supabase.from("writeoff_schedules").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("products").select("id,name,writeoff_mode").order("name"),
      supabase.from("ingredients").select("id,name").order("name"),
    ]);
    setItems(s ?? []);
    setCategories(c ?? []);
    setProducts(p ?? []);
    setIngredients(i ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!draft.name || !draft.target_id) return toast.error("Заполните название и цель");
    const payload = { ...draft, branch_id: draft.branch_id || null };
    const { error } = await supabase.from("writeoff_schedules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Расписание добавлено");
    setDraft({ name: "", branch_id: "", scope: "category", target_id: "", time_of_day: "23:00", days_of_week: [0,1,2,3,4,5,6], active: true });
    load();
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("writeoff_schedules").update({ active }).eq("id", id);
    load();
  }
  async function del(id: string) {
    if (!confirm("Удалить расписание?")) return;
    await supabase.from("writeoff_schedules").delete().eq("id", id);
    load();
  }
  async function runNow(id: string) {
    const { data, error } = await supabase.rpc("run_writeoff_schedule", { _schedule_id: id });
    if (error) return toast.error(error.message);
    toast.success(`✅ Списано. Филиалов обработано: ${(data as any)?.branches_processed ?? "?"}`);
    load();
  }

  const targets = draft.scope === "category" ? categories
                : draft.scope === "product" ? products.filter((p) => p.writeoff_mode === "self")
                : ingredients;
  const targetLabel = (s: any) => {
    if (s.scope === "category") return categories.find((c) => c.id === s.target_id)?.name ?? "?";
    if (s.scope === "product") return products.find((p) => p.id === s.target_id)?.name ?? "?";
    return ingredients.find((i) => i.id === s.target_id)?.name ?? "?";
  };
  const dayShort = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-3xl p-5">
        <h3 className="font-extrabold mb-3">Новое расписание</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-neutral-600 block mb-1">Название</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Списание выпечки в конце дня"
              className="w-full px-3 py-2 rounded-xl border border-neutral-200" /></label>
          <label className="block"><span className="text-xs text-neutral-600 block mb-1">Филиал</span>
            <select value={draft.branch_id} onChange={(e) => setDraft({ ...draft, branch_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200">
              <option value="">🏪 Все филиалы</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></label>
          <label className="block"><span className="text-xs text-neutral-600 block mb-1">Что списываем</span>
            <select value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value, target_id: "" })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200">
              <option value="category">Категория товаров (только режим «само блюдо»)</option>
              <option value="product">Конкретный товар (режим «само блюдо»)</option>
              <option value="ingredient">Ингредиент</option>
            </select></label>
          <label className="block"><span className="text-xs text-neutral-600 block mb-1">Цель</span>
            <select value={draft.target_id} onChange={(e) => setDraft({ ...draft, target_id: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200">
              <option value="">— выберите —</option>
              {targets.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
          <label className="block"><span className="text-xs text-neutral-600 block mb-1">Время</span>
            <input type="time" value={draft.time_of_day} onChange={(e) => setDraft({ ...draft, time_of_day: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200" /></label>
          <div className="block">
            <span className="text-xs text-neutral-600 block mb-1">Дни недели</span>
            <div className="flex gap-1 flex-wrap">
              {dayShort.map((d, i) => {
                const on = draft.days_of_week.includes(i);
                return <button key={i} type="button"
                  onClick={() => setDraft({ ...draft, days_of_week: on ? draft.days_of_week.filter((x: number) => x !== i) : [...draft.days_of_week, i].sort() })}
                  className={`px-3 py-2 rounded-lg text-xs font-bold ${on ? "bg-primary text-white" : "bg-neutral-100"}`}>{d}</button>;
              })}
            </div>
          </div>
        </div>
        <button onClick={save} className="mt-4 px-5 py-2.5 rounded-full bg-primary text-white font-bold">+ Добавить</button>
      </div>

      <div className="bg-white rounded-3xl p-5">
        <h3 className="font-extrabold mb-3">Расписания</h3>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="p-3">Название</th><th>Филиал</th><th>Что</th><th>Время</th><th>Дни</th><th>Последний запуск</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className={`border-t ${!s.active ? "opacity-50" : ""}`}>
                <td className="p-3 font-semibold">{s.name}</td>
                <td>{s.branch_id ? (branches.find((b) => b.id === s.branch_id)?.name ?? "?") : "Все"}</td>
                <td>{s.scope === "category" ? "📂" : s.scope === "product" ? "📦" : "🥬"} {targetLabel(s)}</td>
                <td>{(s.time_of_day || "").slice(0,5)}</td>
                <td className="text-xs">{(s.days_of_week ?? []).map((d: number) => dayShort[d]).join(", ")}</td>
                <td className="text-xs text-neutral-500">{s.last_run_at ? new Date(s.last_run_at).toLocaleString("ru-RU") : "—"}</td>
                <td className="text-right pr-3 whitespace-nowrap">
                  <button onClick={() => runNow(s.id)} className="px-2 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-bold mr-1" title="Запустить сейчас">▶</button>
                  <button onClick={() => toggle(s.id, !s.active)} className="px-2 py-1 rounded-lg hover:bg-neutral-100 text-sm">{s.active ? "⏸" : "▶"}</button>
                  <button onClick={() => del(s.id)} className="px-2 py-1 rounded-lg hover:bg-red-50 text-red-600">🗑</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={7} className="py-8 text-center text-neutral-400">Нет расписаний</td></tr>}
          </tbody>
        </table>
        <p className="text-xs text-neutral-500 mt-3">
          Расписания запускаются автоматически по таймеру (раз в 15 мин). Также можно списать вручную кнопкой ▶.
        </p>
      </div>
    </div>
  );
}

/* ---------- PREPARED INGREDIENTS (соусы/заготовки своего пр-ва) ---------- */
function PreparedTab({ ingredients, reloadIngredients }: { ingredients: Ingredient[]; reloadIngredients: () => Promise<void> }) {
  const [list, setList] = useState<any[]>([]);
  const [allIng, setAllIng] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [components, setComponents] = useState<any[]>([]);
  const [draft, setDraft] = useState({ name: "", unit: "г", prep_yield: 1 });
  const [addComp, setAddComp] = useState({ component_ingredient_id: "", qty: 0 });

  async function load() {
    const { data: prepared } = await supabase.from("ingredients").select("id,name,unit,prep_yield,cost_price").eq("is_prepared", true).order("name");
    setList(prepared ?? []);
    const { data: all } = await supabase.from("ingredients").select("id,name,unit,is_prepared,cost_price").order("name");
    setAllIng(all ?? []);
  }
  useEffect(() => { load(); }, []);

  async function loadComps(id: string) {
    setSelectedId(id);
    const { data } = await supabase.from("ingredient_components").select("id,component_ingredient_id,qty").eq("parent_ingredient_id", id).is("branch_id", null);
    setComponents(data ?? []);
  }

  async function createPrepared() {
    if (!draft.name.trim()) return toast.error("Введите название");
    const { error, data } = await supabase.from("ingredients").insert({
      name: draft.name.trim(), unit: draft.unit, is_prepared: true, prep_yield: Number(draft.prep_yield) || 1,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Заготовка создана");
    setDraft({ name: "", unit: "г", prep_yield: 1 });
    await load();
    await reloadIngredients();
    if (data?.id) loadComps(data.id);
  }

  async function markExistingAsPrepared(id: string) {
    const { error } = await supabase.from("ingredients").update({ is_prepared: true, prep_yield: 1 }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Помечено как заготовка");
    await load();
    loadComps(id);
  }

  async function updateYield(id: string, val: number) {
    await supabase.from("ingredients").update({ prep_yield: val || 1 }).eq("id", id);
    await load();
  }

  async function addComponent() {
    if (!selectedId || !addComp.component_ingredient_id || !addComp.qty) return toast.error("Заполните компонент и кол-во");
    if (addComp.component_ingredient_id === selectedId) return toast.error("Нельзя добавить заготовку саму в себя");
    const { error } = await supabase.from("ingredient_components").insert({
      parent_ingredient_id: selectedId, component_ingredient_id: addComp.component_ingredient_id, qty: Number(addComp.qty), branch_id: null,
    });
    if (error) return toast.error(error.message);
    setAddComp({ component_ingredient_id: "", qty: 0 });
    loadComps(selectedId);
  }

  async function removeComponent(id: string) {
    if (!confirm("Удалить компонент?")) return;
    await supabase.from("ingredient_components").delete().eq("id", id);
    loadComps(selectedId);
  }

  async function recompute() {
    const { error } = await supabase.rpc("recompute_prepared_costs");
    if (error) return toast.error(error.message);
    toast.success("Себестоимость пересчитана");
    await load();
    await reloadIngredients();
  }

  const ingName = (id: string) => allIng.find((i) => i.id === id)?.name ?? id.slice(0, 6);
  const ingUnit = (id: string) => allIng.find((i) => i.id === id)?.unit ?? "";
  const ingCost = (id: string) => Number(allIng.find((i) => i.id === id)?.cost_price ?? 0);
  const selected = list.find((p) => p.id === selectedId);
  const compsCost = components.reduce((s, c) => s + Number(c.qty) * ingCost(c.component_ingredient_id), 0);
  const perUnit = selected ? compsCost / (Number(selected.prep_yield) || 1) : 0;

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-2xl p-5 border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">🧪 Заготовки и соуса</h2>
          <button onClick={recompute} className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-bold">Пересчитать себестоимость</button>
        </div>
        <p className="text-xs text-neutral-500 mb-3">Соус/заготовка собственного производства из других ингредиентов. При продаже блюда автоматически раскрывается и списываются базовые ингредиенты.</p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
          <input placeholder="Название (Чесночный соус)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="px-3 py-2 rounded-xl border sm:col-span-2" />
          <input placeholder="Ед. (г, мл, шт)" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="px-3 py-2 rounded-xl border" />
          <input type="number" placeholder="Выход" value={(draft.prep_yield) || ""} onChange={(e) => setDraft({ ...draft, prep_yield: Number(e.target.value) })} className="px-3 py-2 rounded-xl border" />
        </div>
        <button onClick={createPrepared} className="w-full px-4 py-2 rounded-xl bg-primary text-white font-bold mb-4">+ Создать заготовку</button>

        <div className="mb-3">
          <label className="text-xs text-neutral-500">Или пометить существующий ингредиент:</label>
          <select onChange={(e) => e.target.value && markExistingAsPrepared(e.target.value)} value="" className="w-full mt-1 px-3 py-2 rounded-xl border">
            <option value="">— выбрать ингредиент —</option>
            {allIng.filter((i) => !i.is_prepared).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>

        <div className="border-t pt-3">
          <h3 className="text-sm font-bold mb-2">Список заготовок</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {list.length === 0 && <p className="text-xs text-neutral-400">Пока нет</p>}
            {list.map((p) => (
              <button key={p.id} onClick={() => loadComps(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${selectedId === p.id ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-neutral-50"}`}>
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs text-neutral-500">выход {p.prep_yield} {p.unit} · {Number(p.cost_price).toFixed(2)} ₽/{p.unit}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border">
        {!selected ? (
          <p className="text-sm text-neutral-500">← Выберите заготовку слева для редактирования состава</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold">{selected.name}</h3>
              <span className="text-xs text-neutral-500">себестоимость батча: {compsCost.toFixed(2)} ₽</span>
            </div>
            <div className="flex items-center gap-2 mb-4 text-sm">
              <label>Выход батча:</label>
              <input type="number" defaultValue={selected.prep_yield} onBlur={(e) => updateYield(selected.id, Number(e.target.value))} className="w-24 px-2 py-1 rounded-lg border" />
              <span className="text-neutral-500">{selected.unit}</span>
              <span className="ml-auto font-bold">≈ {perUnit.toFixed(2)} ₽ / {selected.unit}</span>
            </div>

            <h4 className="text-sm font-bold mb-2">Компоненты</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <select value={addComp.component_ingredient_id} onChange={(e) => setAddComp({ ...addComp, component_ingredient_id: e.target.value })} className="px-3 py-2 rounded-xl border sm:col-span-2">
                <option value="">— ингредиент —</option>
                {allIng.filter((i) => i.id !== selectedId).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit}){i.is_prepared ? " 🧪" : ""}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="number" placeholder="Кол-во" value={(addComp.qty || "") || ""} onChange={(e) => setAddComp({ ...addComp, qty: Number(e.target.value) })} className="px-3 py-2 rounded-xl border w-full" />
                <button onClick={addComponent} className="px-3 py-2 rounded-xl bg-primary text-white font-bold">+</button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500 text-xs">
                <tr><th className="py-1">Ингредиент</th><th>Кол-во</th><th>Сумма</th><th></th></tr>
              </thead>
              <tbody>
                {components.length === 0 && <tr><td colSpan={4} className="py-3 text-neutral-400 text-xs">Добавьте компоненты</td></tr>}
                {components.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-2">{ingName(c.component_ingredient_id)}</td>
                    <td>{c.qty} {ingUnit(c.component_ingredient_id)}</td>
                    <td>{(Number(c.qty) * ingCost(c.component_ingredient_id)).toFixed(2)} ₽</td>
                    <td className="text-right"><button onClick={() => removeComponent(c.id)} className="text-red-600 text-xs">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
