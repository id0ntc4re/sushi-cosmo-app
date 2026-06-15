import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Modal } from "./admin.products";

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesAdmin,
});

type Cat = { id: string; name: string; slug: string; sort_order: number; is_active: boolean; image_url: string | null };

function CategoriesAdmin() {
  const [items, setItems] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);

  async function load() {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setItems((data as Cat[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    const name = editing.name?.trim();
    if (!name) return toast.error("Укажите название");
    const payload = {
      name,
      slug: (editing.slug?.trim() || name.toLowerCase().replace(/\s+/g, "-")),
      sort_order: Number(editing.sort_order ?? 0),
      is_active: editing.is_active ?? true,
      image_url: editing.image_url || null,
    };
    const res = editing.id
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Сохранено");
    setEditing(null); load();
  }

  async function remove(id: string) {
    if (!confirm("Удалить категорию? Товары останутся без категории.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалено"); load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold">Категории</h1>
        <button onClick={() => setEditing({ name: "", slug: "", sort_order: items.length, is_active: true })}
          className="px-5 py-2.5 rounded-full bg-primary text-white font-bold">+ Добавить</button>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr><th className="p-3">Сорт.</th><th>Название</th><th>Slug</th><th>Активна</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 text-neutral-500">{c.sort_order}</td>
                <td className="font-semibold">{c.name}</td>
                <td className="text-neutral-500">{c.slug}</td>
                <td>{c.is_active ? "✅" : "—"}</td>
                <td className="text-right pr-3">
                  <button onClick={() => setEditing(c)} className="px-3 py-1.5 hover:bg-neutral-100 rounded-lg">✏️</button>
                  <button onClick={() => remove(c.id)} className="px-3 py-1.5 hover:bg-red-50 text-red-600 rounded-lg">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Редактировать" : "Новая категория"}>
          <div className="space-y-3">
            <label className="block"><span className="text-xs text-neutral-600">Название</span>
              <input className="w-full mt-1 px-3 py-2 rounded-xl border" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-neutral-600">Slug</span>
              <input className="w-full mt-1 px-3 py-2 rounded-xl border" value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="auto" /></label>
            <label className="block"><span className="text-xs text-neutral-600">Сортировка</span>
              <input min="0" placeholder="0" type="number" className="w-full mt-1 px-3 py-2 rounded-xl border" value={(editing.sort_order ?? 0) || ""} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Активна</label>
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
