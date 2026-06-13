import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  gift_product_id: string | null;
  gift_product_name: string | null;
  gift_product_image_url: string | null;
};

type Product = { id: string; name: string; image_url: string | null };

const EMPTY = {
  code: "", discount_type: "percent", discount_value: 10,
  min_order: 0, starts_at: "", expires_at: "", max_uses: "", is_active: true,
  gift_product_id: "", gift_product_name: "", gift_product_image_url: "",
};

function PromosAdmin() {
  const [list, setList] = useState<Promo[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [prodSearch, setProdSearch] = useState("");

  async function load() {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    setList((data as Promo[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!editing) return;
    if (products.length) return;
    (async () => {
      const { data } = await supabase.from("products")
        .select("id,name,image_url").eq("is_active", true)
        .order("name").limit(1000);
      setProducts((data as Product[]) ?? []);
    })();
  }, [editing, products.length]);

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 50);
  }, [prodSearch, products]);

  async function save() {
    if (!editing.code?.trim()) return toast.error("Введите код");
    const isGift = editing.discount_type === "gift";
    if (isGift && !editing.gift_product_id && !editing.gift_product_name?.trim()) {
      return toast.error("Выберите товар или укажите название подарка");
    }
    const payload: any = {
      code: editing.code.trim().toUpperCase(),
      discount_type: editing.discount_type,
      discount_value: isGift ? 0 : (Number(editing.discount_value) || 0),
      min_order: Number(editing.min_order) || 0,
      starts_at: editing.starts_at || null,
      expires_at: editing.expires_at || null,
      max_uses: editing.max_uses === "" || editing.max_uses == null ? null : Number(editing.max_uses),
      is_active: editing.is_active,
      gift_product_id: isGift ? (editing.gift_product_id || null) : null,
      gift_product_name: isGift ? (editing.gift_product_name?.trim() || null) : null,
      gift_product_image_url: isGift ? (editing.gift_product_image_url?.trim() || null) : null,
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

  function rewardText(p: Promo) {
    if (p.discount_type === "gift") {
      const name = p.gift_product_name
        || products.find((x) => x.id === p.gift_product_id)?.name
        || "Подарок";
      return `🎁 ${name}`;
    }
    return `${p.discount_value}${p.discount_type === "percent" ? "%" : " ₽"}`;
  }

  const selectedProduct = editing?.gift_product_id
    ? products.find((p) => p.id === editing.gift_product_id) ?? null
    : null;

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
              <th className="px-4 py-3">Награда</th>
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
                <td className="px-4 py-3">{rewardText(p)}</td>
                <td className="px-4 py-3">{p.min_order} ₽</td>
                <td className="px-4 py-3">{p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ""}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">{p.expires_at ? new Date(p.expires_at).toLocaleDateString("ru") : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${p.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>
                    {p.is_active ? "Активен" : "Выкл."}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing({
                    ...p,
                    starts_at: p.starts_at?.slice(0, 10) ?? "",
                    expires_at: p.expires_at?.slice(0, 10) ?? "",
                    max_uses: p.max_uses ?? "",
                    gift_product_id: p.gift_product_id ?? "",
                    gift_product_name: p.gift_product_name ?? "",
                    gift_product_image_url: p.gift_product_image_url ?? "",
                  })} className="text-primary font-semibold mr-3">Изменить</button>
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
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold">{editing.id ? "Изменить" : "Новый"} промокод</h2>
            <Field label="Код*"><input className={`${inp} uppercase`} value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></Field>
            <Field label="Тип награды">
              <select className={inp} value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}>
                <option value="percent">Скидка в процентах</option>
                <option value="fixed">Скидка фикс. суммой</option>
                <option value="gift">🎁 Подарочный товар</option>
              </select>
            </Field>

            {editing.discount_type !== "gift" && (
              <Field label="Размер скидки">
                <input type="number" className={inp} value={editing.discount_value} onChange={(e) => setEditing({ ...editing, discount_value: e.target.value })} />
              </Field>
            )}

            {editing.discount_type === "gift" && (
              <div className="border-2 border-dashed border-primary/40 rounded-2xl p-3 space-y-3 bg-primary/5">
                <div className="text-xs font-bold text-primary">🎁 Подарочный товар</div>
                <Field label="Товар из меню">
                  <input
                    className={inp}
                    placeholder="Поиск товара…"
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                  />
                  {selectedProduct && (
                    <div className="mt-2 flex items-center gap-2 bg-white border rounded-xl p-2 text-sm">
                      {selectedProduct.image_url && <img src={selectedProduct.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                      <div className="flex-1 font-semibold">{selectedProduct.name}</div>
                      <button type="button" onClick={() => setEditing({ ...editing, gift_product_id: "" })}
                        className="text-xs text-red-500">Убрать</button>
                    </div>
                  )}
                  {!selectedProduct && (
                    <div className="mt-2 max-h-44 overflow-y-auto bg-white rounded-xl border divide-y">
                      {filteredProducts.map((p) => (
                        <button key={p.id} type="button"
                          onClick={() => { setEditing({ ...editing, gift_product_id: p.id, gift_product_name: "", gift_product_image_url: "" }); setProdSearch(""); }}
                          className="flex items-center gap-2 w-full text-left px-2 py-1.5 hover:bg-neutral-50">
                          {p.image_url ? <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-neutral-100" />}
                          <span className="text-sm">{p.name}</span>
                        </button>
                      ))}
                      {!filteredProducts.length && <div className="px-2 py-3 text-center text-xs text-neutral-400">Нет совпадений</div>}
                    </div>
                  )}
                </Field>
                <div className="text-[11px] text-neutral-500 text-center">— или —</div>
                <Field label="Название подарка (если нет в меню)">
                  <input className={inp} value={editing.gift_product_name}
                    onChange={(e) => setEditing({ ...editing, gift_product_name: e.target.value, gift_product_id: "" })}
                    placeholder="Напр. «Фирменный десерт»" />
                </Field>
                <Field label="Картинка подарка (необязательно)">
                  <div className="flex items-center gap-3">
                    {editing.gift_product_image_url && (
                      <img src={editing.gift_product_image_url} alt="" className="w-16 h-16 rounded-lg object-cover border" />
                    )}
                    <label className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold cursor-pointer hover:opacity-90">
                      {editing.gift_product_image_url ? "Заменить" : "📤 Загрузить файл"}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (f.size > 5 * 1024 * 1024) return toast.error("Файл больше 5 МБ");
                          const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
                          const path = `promo-gifts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                          const { error: upErr } = await supabase.storage.from("product-images").upload(path, f, { upsert: false, contentType: f.type });
                          if (upErr) return toast.error(upErr.message);
                          const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
                          setEditing({ ...editing, gift_product_image_url: pub.publicUrl });
                          toast.success("Картинка загружена");
                        }} />
                    </label>
                    {editing.gift_product_image_url && (
                      <button type="button" onClick={() => setEditing({ ...editing, gift_product_image_url: "" })}
                        className="text-xs text-red-500">Удалить</button>
                    )}
                  </div>
                </Field>
              </div>
            )}

            <Field label="Мин. сумма заказа, ₽"><input type="number" className={inp} value={editing.min_order} onChange={(e) => setEditing({ ...editing, min_order: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Действует с (пусто = сразу)"><input type="date" className={inp} value={editing.starts_at} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} /></Field>
              <Field label="Действует до (пусто = бессрочно)"><input type="date" className={inp} value={editing.expires_at} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value })} /></Field>
            </div>
            <div className="text-[11px] text-neutral-500 -mt-1">Если поля пустые — промокод действует без ограничения по сроку.</div>
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
