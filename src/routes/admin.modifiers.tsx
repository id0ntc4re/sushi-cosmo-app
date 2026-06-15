import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/modifiers")({ component: Page });

function Page() {
  const [mods, setMods] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [draft, setDraft] = useState({ name: "", price: 0 });
  const [productId, setProductId] = useState<string>("");

  async function load() {
    const [{ data: m }, { data: p }, { data: l }] = await Promise.all([
      supabase.from("modifiers").select("*").order("name"),
      supabase.from("products").select("id,name").order("name"),
      supabase.from("product_modifiers").select("*"),
    ]);
    setMods(m ?? []); setProducts(p ?? []); setLinks(l ?? []);
    if (!productId && p?.[0]) setProductId(p[0].id);
  }
  useEffect(() => { load(); }, []);

  async function addMod() {
    if (!draft.name) return;
    const { error } = await supabase.from("modifiers").insert(draft);
    if (error) return toast.error(error.message);
    setDraft({ name: "", price: 0 }); load();
  }
  async function delMod(id: string) {
    if (!confirm("Удалить?")) return;
    await supabase.from("modifiers").delete().eq("id", id); load();
  }
  async function updateMod(id: string, patch: any) {
    await supabase.from("modifiers").update(patch).eq("id", id); load();
  }
  async function toggleLink(modId: string) {
    const exists = links.find((l) => l.product_id === productId && l.modifier_id === modId);
    if (exists) {
      await supabase.from("product_modifiers").delete().eq("product_id", productId).eq("modifier_id", modId);
    } else {
      await supabase.from("product_modifiers").insert({ product_id: productId, modifier_id: modId });
    }
    load();
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Модификаторы блюд</h1>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-3xl p-5">
          <h3 className="font-extrabold mb-4">Все модификаторы</h3>
          <div className="grid grid-cols-12 gap-2 mb-4">
            <input className={inp + " col-span-7"} placeholder="Название (бортик, доп. сыр)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input type="number" className={inp + " col-span-3"} placeholder="₽" value={(draft.price) || ""} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />
            <button onClick={addMod} className="col-span-2 rounded-xl bg-primary text-white font-bold">+</button>
          </div>
          <ul className="space-y-2">
            {mods.map((m) => (
              <li key={m.id} className="flex items-center gap-2 bg-neutral-50 rounded-xl p-3">
                <input className="flex-1 bg-transparent font-semibold" defaultValue={m.name}
                  onBlur={(e) => updateMod(m.id, { name: e.target.value })} />
                <input type="number" defaultValue={m.price} className="w-20 px-2 py-1 border rounded text-right"
                  onBlur={(e) => updateMod(m.id, { price: Number(e.target.value) })} /> ₽
                <input type="checkbox" checked={m.is_active} onChange={(e) => updateMod(m.id, { is_active: e.target.checked })} />
                <button onClick={() => delMod(m.id)} className="text-red-500 text-xs">✕</button>
              </li>
            ))}
            {!mods.length && <li className="text-sm text-neutral-400 text-center py-6">Пусто</li>}
          </ul>
        </div>

        <div className="bg-white rounded-3xl p-5">
          <h3 className="font-extrabold mb-4">Привязка к блюду</h3>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inp + " mb-4"}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="space-y-2">
            {mods.map((m) => {
              const linked = links.some((l) => l.product_id === productId && l.modifier_id === m.id);
              return (
                <label key={m.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${linked ? "bg-primary/10 border border-primary" : "bg-neutral-50"}`}>
                  <input type="checkbox" checked={linked} onChange={() => toggleLink(m.id)} />
                  <span className="flex-1 font-semibold">{m.name}</span>
                  <span className="text-sm text-neutral-500">+{m.price} ₽</span>
                </label>
              );
            })}
            {!mods.length && <div className="text-sm text-neutral-400">Сначала создайте модификаторы</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 outline-none focus:border-primary";
