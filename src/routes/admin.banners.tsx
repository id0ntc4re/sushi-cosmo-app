import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/banners")({
  component: BannersAdmin,
});

type Banner = {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_link: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

const EMPTY: Omit<Banner, "id"> = {
  eyebrow: "", title: "", subtitle: "", cta_label: "Смотреть меню",
  cta_link: "#menu", image_url: "", sort_order: 0, is_active: true,
};

function BannersAdmin() {
  const [list, setList] = useState<Banner[]>([]);
  const [editing, setEditing] = useState<any>(null);

  async function load() {
    const { data } = await supabase.from("banners").select("*").order("sort_order");
    setList((data as Banner[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing.title?.trim()) return toast.error("Введите заголовок");
    const { id, ...rest } = editing;
    const { error } = id
      ? await supabase.from("banners").update(rest).eq("id", id)
      : await supabase.from("banners").insert(rest);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    setEditing(null); load();
  }
  async function remove(id: string) {
    if (!confirm("Удалить баннер?")) return;
    await supabase.from("banners").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold">Баннеры</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="px-5 py-2.5 rounded-full bg-primary text-white font-bold">+ Добавить</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {list.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl overflow-hidden">
            {b.image_url && <img src={b.image_url} className="w-full h-40 object-cover" alt="" />}
            <div className="p-4">
              <div className="text-xs text-primary font-bold uppercase">{b.eyebrow}</div>
              <div className="font-extrabold text-lg">{b.title}</div>
              <div className="text-sm text-neutral-500 line-clamp-2">{b.subtitle}</div>
              <div className="mt-3 flex gap-2 items-center">
                <span className={`text-xs px-2 py-1 rounded-full ${b.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>
                  {b.is_active ? "Активен" : "Скрыт"}
                </span>
                <span className="text-xs text-neutral-400">порядок: {b.sort_order}</span>
                <button onClick={() => setEditing(b)} className="ml-auto text-sm text-primary font-semibold">Изменить</button>
                <button onClick={() => remove(b.id)} className="text-sm text-red-500">Удалить</button>
              </div>
            </div>
          </div>
        ))}
        {!list.length && <div className="text-neutral-400 col-span-2 py-10 text-center">Баннеров пока нет</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold">{editing.id ? "Изменить" : "Новый"} баннер</h2>
            <Field label="Eyebrow"><input className={inp} value={editing.eyebrow ?? ""} onChange={(e) => setEditing({ ...editing, eyebrow: e.target.value })} /></Field>
            <Field label="Заголовок*"><input className={inp} value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Подзаголовок"><input className={inp} value={editing.subtitle ?? ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Текст кнопки"><input className={inp} value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} /></Field>
              <Field label="Ссылка кнопки"><input className={inp} value={editing.cta_link ?? ""} onChange={(e) => setEditing({ ...editing, cta_link: e.target.value })} /></Field>
            </div>
            <Field label="URL картинки"><input className={inp} value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Порядок"><input type="number" className={inp} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
              <label className="flex items-end gap-2 pb-2">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                <span className="text-sm">Активен</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-full text-neutral-600">Отмена</button>
              <button onClick={save} className="px-5 py-2 rounded-full bg-primary text-white font-bold">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-primary outline-none";
function Field({ label, children }: any) {
  return <label className="block"><span className="text-sm text-neutral-600 block mb-1">{label}</span>{children}</label>;
}
