import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Modal } from "./admin.products";

export const Route = createFileRoute("/admin/news")({
  component: NewsAdmin,
});

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  kind: string;
  is_active: boolean;
  sort_order: number;
};

const empty: Partial<Post> = { slug: "", title: "", excerpt: "", content: "", image_url: "", kind: "promo", is_active: true, sort_order: 0 };

function NewsAdmin() {
  const [items, setItems] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);

  async function load() {
    const { data } = await supabase.from("news_posts").select("*").order("sort_order").order("published_at", { ascending: false });
    setItems((data as Post[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    const payload: any = {
      slug: editing.slug?.trim(),
      title: editing.title?.trim(),
      excerpt: editing.excerpt || null,
      content: editing.content || "",
      image_url: editing.image_url || null,
      kind: editing.kind || "promo",
      is_active: editing.is_active ?? true,
      sort_order: Number(editing.sort_order ?? 0),
    };
    if (!payload.slug || !payload.title) return toast.error("Укажите slug и заголовок");
    const res = editing.id
      ? await supabase.from("news_posts").update(payload).eq("id", editing.id)
      : await supabase.from("news_posts").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Сохранено");
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Удалить публикацию?")) return;
    const { error } = await supabase.from("news_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-primary outline-none bg-white";

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-3xl font-extrabold">Акции и новости <span className="text-neutral-400 text-xl font-bold">{items.length}</span></h1>
        <button onClick={() => setEditing({ ...empty })} className="px-5 py-2.5 rounded-full bg-primary text-white font-bold">+ Добавить</button>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr><th className="p-3">Заголовок</th><th>Тип</th><th>Slug</th><th>Активна</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t hover:bg-neutral-50/50">
                <td className="p-3 font-semibold">{p.title}</td>
                <td className="text-neutral-600">{p.kind === "promo" ? "Акция" : "Новость"}</td>
                <td className="text-neutral-500 text-xs">/{p.slug}</td>
                <td>{p.is_active ? "✓" : "—"}</td>
                <td className="text-right pr-3">
                  <button onClick={() => setEditing(p)} className="px-3 py-1.5 rounded-lg hover:bg-neutral-100">✏️</button>
                  <button onClick={() => remove(p.id)} className="px-3 py-1.5 rounded-lg hover:bg-red-50 text-red-600">🗑️</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="py-10 text-center text-neutral-400">Пусто</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Редактировать" : "Новая публикация"}>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block md:col-span-2"><span className="text-xs text-neutral-600 block mb-1">Заголовок*</span>
              <input className={inp} value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-neutral-600 block mb-1">Slug (URL)*</span>
              <input className={inp} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="birthday-15" /></label>
            <label className="block"><span className="text-xs text-neutral-600 block mb-1">Тип</span>
              <select className={inp} value={editing.kind ?? "promo"} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
                <option value="promo">Акция</option><option value="news">Новость</option>
              </select></label>
            <label className="block md:col-span-2"><span className="text-xs text-neutral-600 block mb-1">URL изображения</span>
              <input className={inp} value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></label>
            <label className="block md:col-span-2"><span className="text-xs text-neutral-600 block mb-1">Краткое описание</span>
              <textarea className={`${inp} min-h-[60px]`} value={editing.excerpt ?? ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} /></label>
            <label className="block md:col-span-2"><span className="text-xs text-neutral-600 block mb-1">Полный текст</span>
              <textarea className={`${inp} min-h-[180px]`} value={editing.content ?? ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-neutral-600 block mb-1">Сортировка</span>
              <input type="number" className={inp} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></label>
            <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Опубликовано</label>
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
