import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/inventory")({ component: Inventory });

function Inventory() {
  const [tab, setTab] = useState<"stock" | "recipes" | "purchases" | "suppliers">("stock");
  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Склад и техкарты</h1>
      <div className="flex gap-2 mb-5 flex-wrap">
        <Tab on={tab === "stock"} onClick={() => setTab("stock")}>📦 Ингредиенты</Tab>
        <Tab on={tab === "recipes"} onClick={() => setTab("recipes")}>📋 Техкарты</Tab>
        <Tab on={tab === "purchases"} onClick={() => setTab("purchases")}>📥 Приход</Tab>
        <Tab on={tab === "suppliers"} onClick={() => setTab("suppliers")}>🏭 Поставщики</Tab>
      </div>
      {tab === "stock" && <Stock />}
      {tab === "recipes" && <Recipes />}
      {tab === "purchases" && <Purchases />}
      {tab === "suppliers" && <Suppliers />}
    </div>
  );
}

function Tab({ on, ...p }: any) {
  return <button {...p} className={`px-4 py-2 rounded-full text-sm font-bold ${on ? "bg-primary text-white" : "bg-white"}`} />;
}

function Stock() {
  const [items, setItems] = useState<any[]>([]);
  const [draft, setDraft] = useState({ name: "", unit: "г", stock: 0, min_stock: 0, cost_price: 0 });

  async function load() {
    const { data } = await supabase.from("ingredients").select("*").order("name");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!draft.name) return toast.error("Название обязательно");
    const { error } = await supabase.from("ingredients").insert(draft);
    if (error) return toast.error(error.message);
    setDraft({ name: "", unit: "г", stock: 0, min_stock: 0, cost_price: 0 });
    load();
  }
  async function update(id: string, patch: any) {
    await supabase.from("ingredients").update(patch).eq("id", id);
    load();
  }
  async function del(id: string) {
    if (!confirm("Удалить ингредиент?")) return;
    await supabase.from("ingredients").delete().eq("id", id);
    load();
  }
  async function adjust(it: any, delta: number) {
    await supabase.from("ingredients").update({ stock: Number(it.stock) + delta }).eq("id", it.id);
    await supabase.from("stock_movements").insert({ ingredient_id: it.id, delta, reason: "manual" });
    load();
  }

  return (
    <div className="bg-white rounded-3xl p-5">
      <div className="grid grid-cols-12 gap-2 mb-4 items-end">
        <input className={inp + " col-span-3"} placeholder="Название" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className={inp + " col-span-1"} placeholder="ед." value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
        <input type="number" className={inp + " col-span-2"} placeholder="Остаток" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })} />
        <input type="number" className={inp + " col-span-2"} placeholder="Мин." value={draft.min_stock} onChange={(e) => setDraft({ ...draft, min_stock: Number(e.target.value) })} />
        <input type="number" className={inp + " col-span-2"} placeholder="Цена ₽/ед." value={draft.cost_price} onChange={(e) => setDraft({ ...draft, cost_price: Number(e.target.value) })} />
        <button onClick={add} className="col-span-2 px-4 py-2 rounded-xl bg-primary text-white font-bold">+ Добавить</button>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500 border-b">
          <tr><th className="py-2">Ингредиент</th><th>Ед.</th><th>Остаток</th><th>Мин.</th><th>Цена</th><th>Корректировка</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const low = Number(it.stock) <= Number(it.min_stock);
            return (
              <tr key={it.id} className={`border-b ${low ? "bg-red-50" : ""}`}>
                <td className="py-2 font-semibold">{it.name}</td>
                <td>{it.unit}</td>
                <td className={`font-bold ${low ? "text-red-600" : ""}`}>{Number(it.stock)}{low && " ⚠️"}</td>
                <td>
                  <input type="number" defaultValue={it.min_stock} onBlur={(e) => update(it.id, { min_stock: Number(e.target.value) })}
                    className="w-20 px-2 py-1 rounded border" />
                </td>
                <td>
                  <input type="number" defaultValue={it.cost_price} onBlur={(e) => update(it.id, { cost_price: Number(e.target.value) })}
                    className="w-24 px-2 py-1 rounded border" /> ₽
                </td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => adjust(it, -1)} className="px-2 py-1 rounded bg-neutral-100">−1</button>
                    <button onClick={() => adjust(it, +10)} className="px-2 py-1 rounded bg-green-100">+10</button>
                    <button onClick={() => { const v = prompt("На сколько изменить?"); if (v) adjust(it, Number(v)); }}
                      className="px-2 py-1 rounded bg-neutral-100">±N</button>
                  </div>
                </td>
                <td><button onClick={() => del(it.id)} className="text-red-500 text-xs">Удалить</button></td>
              </tr>
            );
          })}
          {!items.length && <tr><td colSpan={7} className="py-8 text-center text-neutral-400">Добавьте ингредиенты</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Recipes() {
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [ingId, setIngId] = useState<string>("");
  const [qty, setQty] = useState(0);

  async function load() {
    const [{ data: p }, { data: i }, { data: r }] = await Promise.all([
      supabase.from("products").select("id,name").order("name"),
      supabase.from("ingredients").select("id,name,unit").order("name"),
      supabase.from("recipes").select("*"),
    ]);
    setProducts(p ?? []); setIngredients(i ?? []); setRecipes(r ?? []);
    if (!productId && p?.[0]) setProductId(p[0].id);
    if (!ingId && i?.[0]) setIngId(i[0].id);
  }
  useEffect(() => { load(); }, []);

  const current = recipes.filter((r) => r.product_id === productId);

  async function add() {
    if (!productId || !ingId || !qty) return;
    const { error } = await supabase.from("recipes").upsert({ product_id: productId, ingredient_id: ingId, qty }, { onConflict: "product_id,ingredient_id" });
    if (error) return toast.error(error.message);
    setQty(0); load();
  }
  async function del(id: string) {
    await supabase.from("recipes").delete().eq("id", id);
    load();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-3xl p-5">
        <h3 className="font-extrabold mb-3">Выберите блюдо</h3>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inp + " mb-4"}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <h4 className="font-bold mb-2 text-sm">Состав:</h4>
        <ul className="space-y-1 mb-4">
          {current.map((r) => {
            const ing = ingredients.find((i) => i.id === r.ingredient_id);
            return (
              <li key={r.id} className="flex justify-between bg-neutral-50 rounded-lg px-3 py-2 text-sm">
                <span>{ing?.name ?? "?"}</span>
                <span className="flex items-center gap-3">
                  <b>{r.qty} {ing?.unit}</b>
                  <button onClick={() => del(r.id)} className="text-red-500 text-xs">✕</button>
                </span>
              </li>
            );
          })}
          {!current.length && <li className="text-xs text-neutral-400">Состав не задан</li>}
        </ul>
      </div>

      <div className="bg-white rounded-3xl p-5">
        <h3 className="font-extrabold mb-3">Добавить ингредиент</h3>
        <select value={ingId} onChange={(e) => setIngId(e.target.value)} className={inp + " mb-3"}>
          {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
        </select>
        <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder="Кол-во"
          className={inp + " mb-3"} />
        <button onClick={add} className="w-full px-4 py-2.5 rounded-xl bg-primary text-white font-bold">+ Добавить в техкарту</button>
        <p className="text-xs text-neutral-500 mt-3">При создании заказа склад автоматически уменьшится на эти кол-ва × кол-во в заказе.</p>
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 outline-none focus:border-primary";
