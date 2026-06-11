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
  const [mode, setMode] = useState<"ingredient" | "component">("ingredient");
  const [ingId, setIngId] = useState<string>("");
  const [componentId, setComponentId] = useState<string>("");
  const [qty, setQty] = useState(0);
  const [cost, setCost] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);

  async function load() {
    const [{ data: p }, { data: i }, { data: r }] = await Promise.all([
      supabase.from("products").select("id,name,is_semi_product,price").order("is_semi_product", { ascending: false }).order("name"),
      supabase.from("ingredients").select("id,name,unit,cost_price").order("name"),
      supabase.from("recipes").select("*"),
    ]);
    setProducts(p ?? []);
    setIngredients(i ?? []);
    setRecipes(r ?? []);
    if (!productId && p?.[0]) setProductId(p[0].id);
    if (!ingId && i?.[0]) setIngId(i[0].id);
    if (!componentId && p?.[0]) setComponentId(p.find((x: any) => x.is_semi_product)?.id ?? p[0].id);
  }
  useEffect(() => { load(); }, []);

  // Себестоимость: рекурсивно раскрываем ТТК через RPC
  useEffect(() => {
    if (!productId) { setCost(null); setPrice(null); return; }
    (async () => {
      const { data, error } = await supabase.rpc("product_cost", { _product_id: productId });
      setCost(error ? null : Number(data ?? 0));
      const p = products.find((x) => x.id === productId);
      setPrice(p ? Number(p.price ?? 0) : null);
    })();
  }, [productId, recipes, products]);

  // ТТК единая для всех филиалов (branch_id IS NULL).
  // Старые филиальные строки тоже показываем — их можно удалить вручную.
  const current = recipes.filter((r) => r.product_id === productId);

  async function add() {
    if (!productId || !qty) return toast.error("Заполните поля");
    const payload: any = {
      product_id: productId,
      branch_id: null,
      qty,
      ingredient_id: mode === "ingredient" ? ingId : null,
      component_product_id: mode === "component" ? componentId : null,
    };
    if (mode === "ingredient" && !ingId) return toast.error("Выберите ингредиент");
    if (mode === "component") {
      if (!componentId) return toast.error("Выберите полуфабрикат");
      if (componentId === productId) return toast.error("Товар не может ссылаться на себя");
    }
    const { error } = await supabase.from("recipes").insert(payload);
    if (error) return toast.error(error.message);
    setQty(0); load();
  }
  async function del(id: string) {
    await supabase.from("recipes").delete().eq("id", id);
    load();
  }

  const selectedProduct = products.find((p) => p.id === productId);
  const semiProducts = products.filter((p) => p.is_semi_product && p.id !== productId);

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-3xl p-5">
        <h3 className="font-extrabold mb-3">Выберите блюдо</h3>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inp + " mb-4"}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.is_semi_product ? "🧪 " : ""}{p.name}</option>
          ))}
        </select>
        {selectedProduct?.is_semi_product && (
          <div className="mb-3 p-2 rounded-lg bg-amber-50 text-amber-800 text-xs">
            🧪 Это полуфабрикат — его можно добавлять компонентом в другие ТТК
          </div>
        )}
        <h4 className="font-bold mb-2 text-sm">Состав (единый для всех филиалов):</h4>
        <ul className="space-y-1 mb-4">
          {current.map((r) => {
            const ing = ingredients.find((i) => i.id === r.ingredient_id);
            const comp = products.find((p) => p.id === r.component_product_id);
            const lineCost = r.ingredient_id ? Number(r.qty) * Number(ing?.cost_price ?? 0) : null;
            return (
              <li key={r.id} className="flex justify-between bg-neutral-50 rounded-lg px-3 py-2 text-sm">
                <span>{r.component_product_id ? `🧪 ${comp?.name ?? "?"}` : (ing?.name ?? "?")}</span>
                <span className="flex items-center gap-3">
                  <b>{r.qty}{r.ingredient_id ? ` ${ing?.unit ?? ""}` : " шт"}</b>
                  {lineCost !== null && <span className="text-xs text-neutral-500 w-16 text-right">{lineCost.toFixed(2)} ₽</span>}
                  <button onClick={() => del(r.id)} className="text-red-500 text-xs">✕</button>
                </span>
              </li>
            );
          })}
          {!current.length && <li className="text-xs text-neutral-400">Состав не задан</li>}
        </ul>
        {current.length > 0 && (
          <div className="rounded-2xl bg-neutral-900 text-white p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-300">💰 Себестоимость:</span>
              <b className="text-lg">{cost?.toFixed(2) ?? "—"} ₽</b>
            </div>
            {!selectedProduct?.is_semi_product && price !== null && price > 0 && cost !== null && (
              <>
                <div className="flex justify-between">
                  <span className="text-neutral-300">🏷 Цена продажи:</span>
                  <span>{price.toFixed(2)} ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-300">📈 Маржа:</span>
                  <b className={price - cost > 0 ? "text-green-400" : "text-red-400"}>
                    {(price - cost).toFixed(2)} ₽ ({((1 - cost / price) * 100).toFixed(1)}%)
                  </b>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-300">📊 Наценка:</span>
                  <span>{cost > 0 ? (((price - cost) / cost) * 100).toFixed(1) : "∞"}%</span>
                </div>
              </>
            )}
            <p className="text-xs text-neutral-400 pt-1">Учитывает закупочную цену ингредиентов (средневзвешенную по приходным накладным) и рекурсивно раскрывает полуфабрикаты.</p>
          </div>
        )}
      </div>



      <div className="bg-white rounded-3xl p-5">
        <h3 className="font-extrabold mb-3">Добавить компонент</h3>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setMode("ingredient")} className={`flex-1 px-3 py-2 rounded-xl font-bold text-sm ${mode === "ingredient" ? "bg-primary text-white" : "bg-neutral-100"}`}>
            🥬 Ингредиент
          </button>
          <button onClick={() => setMode("component")} className={`flex-1 px-3 py-2 rounded-xl font-bold text-sm ${mode === "component" ? "bg-primary text-white" : "bg-neutral-100"}`}>
            🧪 Полуфабрикат
          </button>
        </div>
        {mode === "ingredient" ? (
          <select value={ingId} onChange={(e) => setIngId(e.target.value)} className={inp + " mb-3"}>
            {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        ) : (
          <select value={componentId} onChange={(e) => setComponentId(e.target.value)} className={inp + " mb-3"}>
            {semiProducts.length === 0 && <option value="">— нет полуфабрикатов —</option>}
            {semiProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <input type="number" step="0.01" value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder="Кол-во"
          className={inp + " mb-3"} />
        <button onClick={add} className="w-full px-4 py-2.5 rounded-xl bg-primary text-white font-bold">+ Добавить в техкарту</button>
        <p className="text-xs text-neutral-500 mt-3">
          ТТК единая для всех филиалов. Списание идёт со склада того филиала, к которому привязан заказ — с раскрытием полуфабрикатов в ингредиенты.
        </p>
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 outline-none focus:border-primary";

function Suppliers() {
  const [items, setItems] = useState<any[]>([]);
  const [draft, setDraft] = useState({ name: "", phone: "", inn: "", contact_person: "", note: "" });

  async function load() {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!draft.name) return toast.error("Название обязательно");
    const { error } = await supabase.from("suppliers").insert(draft);
    if (error) return toast.error(error.message);
    setDraft({ name: "", phone: "", inn: "", contact_person: "", note: "" });
    load();
  }
  async function del(id: string) {
    if (!confirm("Удалить поставщика?")) return;
    await supabase.from("suppliers").delete().eq("id", id);
    load();
  }
  async function update(id: string, patch: any) {
    await supabase.from("suppliers").update(patch).eq("id", id);
    load();
  }

  return (
    <div className="bg-white rounded-3xl p-5">
      <div className="grid grid-cols-12 gap-2 mb-4">
        <input className={inp + " col-span-3"} placeholder="Название*" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className={inp + " col-span-2"} placeholder="Телефон" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        <input className={inp + " col-span-2"} placeholder="ИНН" value={draft.inn} onChange={(e) => setDraft({ ...draft, inn: e.target.value })} />
        <input className={inp + " col-span-2"} placeholder="Контакт" value={draft.contact_person} onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })} />
        <input className={inp + " col-span-2"} placeholder="Заметка" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        <button onClick={add} className="col-span-1 px-3 py-2 rounded-xl bg-primary text-white font-bold">+</button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500 border-b">
          <tr><th className="py-2">Поставщик</th><th>Телефон</th><th>ИНН</th><th>Контакт</th><th>Заметка</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="py-2 font-semibold">
                <input defaultValue={s.name} onBlur={(e) => update(s.id, { name: e.target.value })} className="px-2 py-1 rounded border w-full" />
              </td>
              <td><input defaultValue={s.phone ?? ""} onBlur={(e) => update(s.id, { phone: e.target.value })} className="px-2 py-1 rounded border w-32" /></td>
              <td><input defaultValue={s.inn ?? ""} onBlur={(e) => update(s.id, { inn: e.target.value })} className="px-2 py-1 rounded border w-28" /></td>
              <td><input defaultValue={s.contact_person ?? ""} onBlur={(e) => update(s.id, { contact_person: e.target.value })} className="px-2 py-1 rounded border w-32" /></td>
              <td><input defaultValue={s.note ?? ""} onBlur={(e) => update(s.id, { note: e.target.value })} className="px-2 py-1 rounded border w-40" /></td>
              <td><button onClick={() => del(s.id)} className="text-red-500 text-xs">Удалить</button></td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={6} className="py-8 text-center text-neutral-400">Добавьте поставщиков</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Purchases() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function load() {
    const [{ data: inv }, { data: sup }, { data: br }, { data: ing }] = await Promise.all([
      supabase.from("purchase_invoices").select("*, suppliers(name), branches(name)").order("invoice_date", { ascending: false }),
      supabase.from("suppliers").select("id,name").order("name"),
      supabase.from("branches").select("id,name").order("name"),
      supabase.from("ingredients").select("id,name,unit,cost_price,stock").order("name"),
    ]);
    setInvoices(inv ?? []); setSuppliers(sup ?? []); setBranches(br ?? []); setIngredients(ing ?? []);
  }
  useEffect(() => { load(); }, []);

  async function createDraft() {
    if (!branches.length) return toast.error("Сначала создайте филиал");
    if (!suppliers.length) return toast.error("Сначала добавьте поставщика");
    const { data, error } = await supabase.from("purchase_invoices").insert({
      supplier_id: suppliers[0].id,
      branch_id: branches[0].id,
    }).select().single();
    if (error) return toast.error(error.message);
    setEditing({ ...data, items: [] });
    load();
  }

  async function openEdit(inv: any) {
    const { data } = await supabase.from("purchase_invoice_items").select("*").eq("invoice_id", inv.id);
    setEditing({ ...inv, items: data ?? [] });
  }

  async function delInvoice(id: string) {
    if (!confirm("Удалить черновик накладной?")) return;
    await supabase.from("purchase_invoices").delete().eq("id", id);
    load();
  }

  if (editing) {
    return <InvoiceEditor inv={editing} suppliers={suppliers} branches={branches} ingredients={ingredients}
      onClose={() => { setEditing(null); load(); }} />;
  }

  return (
    <div className="bg-white rounded-3xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-extrabold text-lg">Приходные накладные</h3>
        <button onClick={createDraft} className="px-4 py-2 rounded-xl bg-primary text-white font-bold">+ Новая накладная</button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500 border-b">
          <tr><th className="py-2">№</th><th>Дата</th><th>Поставщик</th><th>Филиал</th><th>Сумма</th><th>Статус</th><th></th></tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} className="border-b">
              <td className="py-2 font-semibold">{i.invoice_number ?? "—"}</td>
              <td>{i.invoice_date}</td>
              <td>{i.suppliers?.name ?? "—"}</td>
              <td>{i.branches?.name ?? "—"}</td>
              <td className="font-bold">{Number(i.total).toFixed(2)} ₽</td>
              <td>
                {i.status === "posted"
                  ? <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Проведена</span>
                  : <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-700">Черновик</span>}
              </td>
              <td className="flex gap-2 py-2">
                <button onClick={() => openEdit(i)} className="text-primary text-xs font-bold">
                  {i.status === "posted" ? "Открыть" : "Редактировать"}
                </button>
                {i.status !== "posted" && (
                  <button onClick={() => delInvoice(i.id)} className="text-red-500 text-xs">Удалить</button>
                )}
              </td>
            </tr>
          ))}
          {!invoices.length && <tr><td colSpan={7} className="py-8 text-center text-neutral-400">Накладных пока нет</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceEditor({ inv, suppliers, branches, ingredients, onClose }: any) {
  const [header, setHeader] = useState({
    supplier_id: inv.supplier_id ?? "",
    branch_id: inv.branch_id ?? "",
    invoice_number: inv.invoice_number ?? "",
    invoice_date: inv.invoice_date,
    note: inv.note ?? "",
  });
  const [items, setItems] = useState<any[]>(inv.items ?? []);
  const [newItem, setNewItem] = useState({ ingredient_id: ingredients[0]?.id ?? "", qty: 0, price: 0 });
  const posted = inv.status === "posted";

  const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0);

  async function saveHeader() {
    const { error } = await supabase.from("purchase_invoices").update(header).eq("id", inv.id);
    if (error) toast.error(error.message); else toast.success("Сохранено");
  }

  async function addItem() {
    if (!newItem.ingredient_id || !newItem.qty || !newItem.price) return toast.error("Заполните все поля");
    const total = newItem.qty * newItem.price;
    const { data, error } = await supabase.from("purchase_invoice_items").insert({
      invoice_id: inv.id, ...newItem, total,
    }).select().single();
    if (error) return toast.error(error.message);
    setItems([...items, data]);
    setNewItem({ ingredient_id: ingredients[0]?.id ?? "", qty: 0, price: 0 });
  }

  async function delItem(id: string) {
    await supabase.from("purchase_invoice_items").delete().eq("id", id);
    setItems(items.filter((i) => i.id !== id));
  }

  async function post() {
    if (!items.length) return toast.error("Добавьте позиции");
    if (!confirm(`Провести накладную на ${total.toFixed(2)} ₽? Остатки будут увеличены, себестоимость пересчитана.`)) return;
    await saveHeader();
    const { error } = await supabase.rpc("post_purchase_invoice", { _invoice_id: inv.id });
    if (error) return toast.error(error.message);
    toast.success("Накладная проведена, остатки обновлены");
    onClose();
  }

  return (
    <div className="bg-white rounded-3xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-extrabold text-lg">
          {posted ? "Просмотр накладной" : "Редактирование накладной"}
        </h3>
        <button onClick={onClose} className="text-neutral-500 text-sm">← Назад к списку</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <div>
          <label className="text-xs text-neutral-500">Поставщик</label>
          <select disabled={posted} value={header.supplier_id} onChange={(e) => setHeader({ ...header, supplier_id: e.target.value })} className={inp}>
            <option value="">—</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">Филиал</label>
          <select disabled={posted} value={header.branch_id} onChange={(e) => setHeader({ ...header, branch_id: e.target.value })} className={inp}>
            <option value="">—</option>
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-500">№ накладной</label>
          <input disabled={posted} value={header.invoice_number} onChange={(e) => setHeader({ ...header, invoice_number: e.target.value })} className={inp} />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Дата</label>
          <input disabled={posted} type="date" value={header.invoice_date} onChange={(e) => setHeader({ ...header, invoice_date: e.target.value })} className={inp} />
        </div>
        <div>
          <label className="text-xs text-neutral-500">Заметка</label>
          <input disabled={posted} value={header.note} onChange={(e) => setHeader({ ...header, note: e.target.value })} className={inp} />
        </div>
      </div>

      <h4 className="font-bold mb-2">Позиции</h4>
      <table className="w-full text-sm mb-4">
        <thead className="text-left text-neutral-500 border-b">
          <tr><th className="py-2">Ингредиент</th><th>Кол-во</th><th>Цена/ед.</th><th>Сумма</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const ing = ingredients.find((i: any) => i.id === it.ingredient_id);
            return (
              <tr key={it.id} className="border-b">
                <td className="py-2 font-semibold">{ing?.name ?? "?"}</td>
                <td>{Number(it.qty)} {ing?.unit}</td>
                <td>{Number(it.price).toFixed(2)} ₽</td>
                <td className="font-bold">{(Number(it.qty) * Number(it.price)).toFixed(2)} ₽</td>
                <td>{!posted && <button onClick={() => delItem(it.id)} className="text-red-500 text-xs">✕</button>}</td>
              </tr>
            );
          })}
          {!items.length && <tr><td colSpan={5} className="py-4 text-center text-neutral-400">Позиций нет</td></tr>}
        </tbody>
        <tfoot>
          <tr className="border-t-2">
            <td colSpan={3} className="py-2 text-right font-bold">Итого:</td>
            <td className="font-extrabold text-lg">{total.toFixed(2)} ₽</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {!posted && (
        <>
          <div className="grid grid-cols-12 gap-2 mb-4 bg-neutral-50 p-3 rounded-xl">
            <select value={newItem.ingredient_id} onChange={(e) => setNewItem({ ...newItem, ingredient_id: e.target.value })} className={inp + " col-span-5"}>
              {ingredients.map((i: any) => <option key={i.id} value={i.id}>{i.name} (ост: {Number(i.stock)} {i.unit}, цена: {Number(i.cost_price).toFixed(2)} ₽)</option>)}
            </select>
            <input type="number" placeholder="Кол-во" value={newItem.qty || ""} onChange={(e) => setNewItem({ ...newItem, qty: Number(e.target.value) })} className={inp + " col-span-2"} />
            <input type="number" step="0.01" placeholder="Цена за ед." value={newItem.price || ""} onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })} className={inp + " col-span-2"} />
            <div className="col-span-2 px-3 py-2 font-bold">{(newItem.qty * newItem.price).toFixed(2)} ₽</div>
            <button onClick={addItem} className="col-span-1 px-3 py-2 rounded-xl bg-primary text-white font-bold">+</button>
          </div>

          <div className="flex gap-3">
            <button onClick={saveHeader} className="px-5 py-2.5 rounded-xl bg-neutral-100 font-bold">💾 Сохранить черновик</button>
            <button onClick={post} className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-bold">✓ Провести накладную</button>
          </div>
          <p className="text-xs text-neutral-500 mt-3">
            При проведении: остатки ингредиентов увеличатся на указанные количества, себестоимость пересчитается по средневзвешенной цене.
          </p>
        </>
      )}
    </div>
  );
}
