import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/products")({
  component: ProductsAdmin,
});

type Cat = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: number;
  weight: string | null;
  category_id: string | null;
  image_url: string | null;
  is_active: boolean;
  in_stock: boolean;
  sort_order: number;
  sku: string | null;
  is_addon: boolean;
  is_recommended: boolean;
  tags: string[];
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  is_semi_product: boolean;
  writeoff_mode: "ingredients" | "self";
};


const TAGS = [
  { id: "spicy", label: "🌶 Острое" },
  { id: "vegan", label: "🌱 Веган" },
  { id: "no_fish", label: "🚫🐟 Без рыбы" },
  { id: "baked", label: "🔥 Запечённые" },
  { id: "new", label: "✨ Новинка" },
];

const empty: Partial<Product> = {
  name: "", price: 0, weight: "", description: "", ingredients: "", image_url: "",
  category_id: null, is_active: true, in_stock: true, sort_order: 0, sku: "",
  is_addon: false, is_recommended: false, tags: [], is_semi_product: false,
  writeoff_mode: "ingredients",
};

function ProductsAdmin() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  async function load() {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("categories").select("id,name").order("sort_order"),
      supabase.from("products").select("*").order("sort_order").order("name"),
    ]);
    setCats((c as Cat[]) ?? []);
    setItems((p as Product[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    const payload: any = {
      name: editing.name?.trim(),
      description: editing.description || null,
      ingredients: editing.ingredients || null,
      price: Number(editing.price ?? 0),
      weight: editing.weight || null,
      category_id: editing.category_id || null,
      image_url: editing.image_url || null,
      is_active: editing.is_active ?? true,
      in_stock: editing.in_stock ?? true,
      sort_order: Number(editing.sort_order ?? 0),
      sku: editing.sku || null,
      is_addon: editing.is_addon ?? false,
      is_recommended: editing.is_recommended ?? false,
      tags: editing.tags ?? [],
      calories: editing.calories === null || editing.calories === undefined || (editing.calories as any) === "" ? null : Number(editing.calories),
      protein: editing.protein === null || editing.protein === undefined || (editing.protein as any) === "" ? null : Number(editing.protein),
      fat: editing.fat === null || editing.fat === undefined || (editing.fat as any) === "" ? null : Number(editing.fat),
      carbs: editing.carbs === null || editing.carbs === undefined || (editing.carbs as any) === "" ? null : Number(editing.carbs),
      is_semi_product: editing.is_semi_product ?? false,
      writeoff_mode: editing.writeoff_mode ?? "ingredients",
    };
    if (!payload.name) return toast.error("Укажите название");
    const res = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);

    if (res.error) return toast.error(res.error.message);
    toast.success(editing.id ? "Обновлено" : "Создано");
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Удалить товар?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалено");
    load();
  }

  async function toggle(p: Product, field: "is_active" | "in_stock") {
    const { error } = await supabase.from("products").update({ [field]: !p[field] } as any).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  }

  const filtered = items.filter((p) => {
    if (filterCat && p.category_id !== filterCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-3xl font-extrabold">Товары <span className="text-neutral-400 text-xl font-bold">{items.length}</span></h1>
        <button onClick={() => setEditing({ ...empty })} className="px-5 py-2.5 rounded-full bg-primary text-white font-bold">
          + Добавить товар
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input placeholder="Поиск…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-neutral-200 bg-white min-w-[240px]" />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-neutral-200 bg-white">
          <option value="">Все категории</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="p-3">Фото</th>
              <th>Название</th>
              <th>Категория</th>
              <th>Цена</th>
              <th>Активен</th>
              <th>В наличии</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t hover:bg-neutral-50/50">
                <td className="p-3">
                  <div className="h-12 w-12 rounded-lg bg-neutral-100 grid place-items-center overflow-hidden text-xl">
                    {p.image_url ? <img src={p.image_url} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="" /> : "🍣"}
                  </div>
                </td>
                <td>
                  <div className="font-semibold">{p.name}</div>
                  {p.weight && <div className="text-xs text-neutral-500">{p.weight}</div>}
                </td>
                <td className="text-neutral-600">{cats.find((c) => c.id === p.category_id)?.name ?? "—"}</td>
                <td className="font-bold">{Number(p.price)} ₽</td>
                <td><Toggle on={p.is_active} onChange={() => toggle(p, "is_active")} /></td>
                <td><Toggle on={p.in_stock} onChange={() => toggle(p, "in_stock")} /></td>
                <td className="text-right pr-3">
                  <button onClick={() => setEditing(p)} className="px-3 py-1.5 rounded-lg hover:bg-neutral-100 text-sm">✏️</button>
                  <button onClick={() => remove(p.id)} className="px-3 py-1.5 rounded-lg hover:bg-red-50 text-red-600 text-sm">🗑️</button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="py-10 text-center text-neutral-400">Ничего не найдено</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Редактировать товар" : "Новый товар"}>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Название*"><input className={inp} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="SKU"><input className={inp} value={editing.sku ?? ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} /></Field>
            <Field label="Цена*"><input type="number" className={inp} value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></Field>
            <Field label="Вес/объём"><input className={inp} value={editing.weight ?? ""} onChange={(e) => setEditing({ ...editing, weight: e.target.value })} placeholder="220 г" /></Field>
            <Field label="Категория">
              <select className={inp} value={editing.category_id ?? ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })}>
                <option value="">— нет —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Сортировка"><input type="number" className={inp} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
            <div className="md:col-span-2">
              <span className="text-xs text-neutral-600 block mb-1">Пищевая ценность (на порцию, можно оставить пустым)</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Field label="Ккал"><input type="number" step="0.1" className={inp} value={editing.calories ?? ""} onChange={(e) => setEditing({ ...editing, calories: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Белки, г"><input type="number" step="0.1" className={inp} value={editing.protein ?? ""} onChange={(e) => setEditing({ ...editing, protein: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Жиры, г"><input type="number" step="0.1" className={inp} value={editing.fat ?? ""} onChange={(e) => setEditing({ ...editing, fat: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Углев., г"><input type="number" step="0.1" className={inp} value={editing.carbs ?? ""} onChange={(e) => setEditing({ ...editing, carbs: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              </div>
            </div>

            <div className="md:col-span-2">
              <Field label="Изображение">
                <div className="flex items-start gap-3">
                  <div className="h-24 w-24 rounded-xl bg-neutral-100 grid place-items-center overflow-hidden text-3xl shrink-0">
                    {editing.image_url ? <img src={editing.image_url} className="w-full h-full object-cover" alt="" /> : "🍣"}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input className={inp} value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} placeholder="URL или загрузите файл ниже" />
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-sm font-semibold cursor-pointer">
                        📤 Загрузить
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          const ext = file.name.split(".").pop() || "jpg";
                          const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
                          const up = await supabase.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
                          if (up.error) return toast.error(up.error.message);
                          const { data } = supabase.storage.from("product-images").getPublicUrl(path);
                          setEditing((prev) => ({ ...(prev ?? {}), image_url: data.publicUrl }));
                          toast.success("Изображение загружено");
                          e.target.value = "";
                        }} />
                      </label>
                      {editing.image_url && (
                        <button type="button" onClick={() => setEditing({ ...editing, image_url: "" })} className="px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-semibold">Удалить</button>
                      )}
                    </div>
                  </div>
                </div>
              </Field>
            </div>
            <div className="md:col-span-2"><Field label="Описание"><textarea className={`${inp} min-h-[80px]`} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field></div>
            <div className="md:col-span-2"><Field label="Состав"><textarea className={`${inp} min-h-[60px]`} value={editing.ingredients ?? ""} onChange={(e) => setEditing({ ...editing, ingredients: e.target.value })} placeholder="Рис, нори, лосось, огурец…" /></Field></div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Активен</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.in_stock ?? true} onChange={(e) => setEditing({ ...editing, in_stock: e.target.checked })} /> В наличии</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_addon ?? false} onChange={(e) => setEditing({ ...editing, is_addon: e.target.checked })} /> Доп. товар (соус/палочки)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_recommended ?? false} onChange={(e) => setEditing({ ...editing, is_recommended: e.target.checked })} /> Рекомендуемый («с этим заказывают»)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_semi_product ?? false} onChange={(e) => setEditing({ ...editing, is_semi_product: e.target.checked })} /> 🧪 Полуфабрикат (не показывать на витрине, использовать в ТТК)</label>
            <div className="md:col-span-2">
              <Field label="Метод списания со склада">
                <select className={inp} value={editing.writeoff_mode ?? "ingredients"} onChange={(e) => setEditing({ ...editing, writeoff_mode: e.target.value as any })}>
                  <option value="ingredients">🥬 Ингредиенты по ТТК (для блюд)</option>
                  <option value="self">📦 Само блюдо/товар (для готовых: вода, кола, упаковка)</option>
                </select>
                <span className="text-xs text-neutral-500 mt-1 block">
                  «Само блюдо» — отслеживается остаток самого товара по филиалам (как ингредиент). Используйте для напитков, готовых соусов в бутылках, упаковки и т.п.
                </span>
              </Field>
            </div>
            <div className="md:col-span-2">
              <span className="text-xs text-neutral-600 block mb-1">Теги</span>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => {
                  const on = (editing.tags ?? []).includes(t.id);
                  return (
                    <button key={t.id} type="button"
                      onClick={() => setEditing({ ...editing, tags: on ? (editing.tags ?? []).filter((x) => x !== t.id) : [...(editing.tags ?? []), t.id] })}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? "bg-primary text-white border-primary" : "bg-white border-neutral-200 hover:border-primary"}`}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-6 justify-end">
            <button onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-full bg-neutral-100 font-semibold">Отмена</button>
            <button onClick={save} className="px-5 py-2.5 rounded-full bg-primary text-white font-bold">Сохранить</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-primary outline-none bg-white";
function Field({ label, children }: any) {
  return <label className="block"><span className="text-xs text-neutral-600 block mb-1">{label}</span>{children}</label>;
}
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`w-10 h-6 rounded-full transition relative ${on ? "bg-primary" : "bg-neutral-300"}`}>
      <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
export function Modal({ onClose, title, children }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-extrabold">{title}</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-neutral-100 text-2xl">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
