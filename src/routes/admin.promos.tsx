import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/promos")({
  component: PromosAdmin,
});

type Promo = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
};

const EMPTY = {
  code: "", discount_type: "percent", discount_value: 10,
  min_order: 0, starts_at: "", expires_at: "", max_uses: "", is_active: true,
};

function PromosAdmin() {
  const [list, setList] = useState<Promo[]>([]);
  const [editing, setEditing] = useState<any>(null);

  async function load() {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    setList((data as Promo[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing.code?.trim()) return toast.error("Введите код");
    const payload: any = {
      code: editing.code.trim().toUpperCase(),
      discount_type: editing.discount_type,
      discount_value: Number(editing.discount_value) || 0,
      min_order: Number(editing.min_order) || 0,
      starts_at: editing.starts_at || null,
      expires_at: editing.expires_at || null,
      max_uses: editing.max_uses === "" || editing.max_uses == null ? null : Number(editing.max_uses),
      is_active: editing.is_active,
    };
    const { error } = editing.id
      ? await supabase.from("promo_codes").update(payload).eq("id", editing.id)
      : await supabase.from("promo_codes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    setEditing(null); load();
  }
  async function remove(id: string) {
    if (!confirm("Удалить промокод?")) return;
    await supabase.from("promo_codes").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold">Промокоды</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="px-5 py-2.5 rounded-full bg-primary text-white font-bold">+ Добавить</button>
      </div>

      <div className="bg-white rounded-3xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="px-4 py-3">Код</th>
              <th className="px-4 py-3">Скидка</th>
              <th className="px-4 py-3">Мин. сумма</th>
              <th className="px-4 py-3">Использований</th>
              <th className="px-4 py-3">Срок</th>
              <th className="px-4 py-3">Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3 font-mono font-bold">{p.code}</td>
                <td className="px-4 py-3">{p.discount_value}{p.discount_type === "percent" ? "%" : " ₽"}</td>
                <td className="px-4 py-3">{p.min_order} ₽</td>
                <td className="px-4 py-3">{p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ""}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">{p.expires_at ? new Date(p.expires_at).toLocaleDateString("ru") : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${p.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>
                    {p.is_active ? "Активен" : "Выкл."}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing({ ...p, starts_at: p.starts_at?.slice(0, 10) ?? "", expires_at: p.expires_at?.slice(0, 10) ?? "", max_uses: p.max_uses ?? "" })} className="text-primary font-semibold mr-3">Изменить</button>
                  <button onClick={() => remove(p.id)} className="text-red-500">Удалить</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="py-10 text-center text-neutral-400">Нет промокодов</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold">{editing.id ? "Изменить" : "Новый"} промокод</h2>
            <Field label="Код*"><input className={`${inp} uppercase`} value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Тип скидки">
                <select className={inp} value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}>
                  <option value="percent">Процент</option>
                  <option value="fixed">Фикс. сумма</option>
                </select>
              </Field>
              <Field label="Размер"><input type="number" className={inp} value={editing.discount_value} onChange={(e) => setEditing({ ...editing, discount_value: e.target.value })} /></Field>
            </div>
            <Field label="Мин. сумма заказа, ₽"><input type="number" className={inp} value={editing.min_order} onChange={(e) => setEditing({ ...editing, min_order: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Действует с"><input type="date" className={inp} value={editing.starts_at} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} /></Field>
              <Field label="Действует до"><input type="date" className={inp} value={editing.expires_at} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value })} /></Field>
            </div>
            <Field label="Макс. использований (пусто = без лимита)"><input type="number" className={inp} value={editing.max_uses} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value })} /></Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              <span className="text-sm">Активен</span>
            </label>
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
