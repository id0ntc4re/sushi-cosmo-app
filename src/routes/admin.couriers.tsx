import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/couriers")({ component: Page });

function Page() {
  const [tab, setTab] = useState<"couriers" | "zones">("couriers");
  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Курьеры и зоны доставки</h1>
      <div className="flex gap-2 mb-5">
        <Tab on={tab === "couriers"} onClick={() => setTab("couriers")}>🛵 Курьеры</Tab>
        <Tab on={tab === "zones"} onClick={() => setTab("zones")}>📍 Зоны</Tab>
      </div>
      {tab === "couriers" ? <Couriers /> : <Zones />}
    </div>
  );
}

function Tab({ on, ...p }: any) {
  return <button {...p} className={`px-4 py-2 rounded-full text-sm font-bold ${on ? "bg-primary text-white" : "bg-white"}`} />;
}

function Couriers() {
  const [list, setList] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [draft, setDraft] = useState({ name: "", phone: "" });

  async function load() {
    const { data } = await supabase.from("couriers").select("*").order("name");
    setList(data ?? []);
    const { data: o } = await supabase.from("orders")
      .select("id,number,total,courier_id,status,address")
      .in("status", ["delivering"]);
    setActive(o ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!draft.name) return;
    const { error } = await supabase.from("couriers").insert(draft);
    if (error) return toast.error(error.message);
    setDraft({ name: "", phone: "" }); load();
  }
  async function update(id: string, patch: any) {
    await supabase.from("couriers").update(patch).eq("id", id); load();
  }
  async function del(id: string) {
    if (!confirm("Удалить?")) return;
    await supabase.from("couriers").delete().eq("id", id); load();
  }
  async function assign(orderId: string, courierId: string) {
    await supabase.from("orders").update({ courier_id: courierId || null }).eq("id", orderId);
    load();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-3xl p-5">
        <h3 className="font-extrabold mb-4">Список курьеров</h3>
        <div className="grid grid-cols-12 gap-2 mb-4">
          <input className={inp + " col-span-5"} placeholder="Имя" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className={inp + " col-span-5"} placeholder="Телефон" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          <button onClick={add} className="col-span-2 rounded-xl bg-primary text-white font-bold">+</button>
        </div>
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 bg-neutral-50 rounded-xl p-3">
              <div className={`w-3 h-3 rounded-full ${c.is_active ? "bg-green-500" : "bg-neutral-300"}`} />
              <div className="flex-1">
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-neutral-500">{c.phone ?? "—"}</div>
              </div>
              <button onClick={() => update(c.id, { is_active: !c.is_active })}
                className="text-xs px-3 py-1 rounded-full bg-white">{c.is_active ? "Свободен" : "Не на смене"}</button>
              <button onClick={() => del(c.id)} className="text-red-500 text-xs">✕</button>
            </li>
          ))}
          {!list.length && <li className="text-sm text-neutral-400 text-center py-6">Курьеров пока нет</li>}
        </ul>
      </div>

      <div className="bg-white rounded-3xl p-5">
        <h3 className="font-extrabold mb-4">Заказы в доставке ({active.length})</h3>
        <ul className="space-y-3">
          {active.map((o) => (
            <li key={o.id} className="bg-neutral-50 rounded-xl p-3">
              <div className="flex justify-between mb-1">
                <b>#{o.number}</b>
                <b className="text-primary">{Number(o.total)} ₽</b>
              </div>
              <div className="text-xs text-neutral-600 mb-2 truncate">📍 {o.address ?? "—"}</div>
              <select value={o.courier_id ?? ""} onChange={(e) => assign(o.id, e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border text-sm">
                <option value="">— назначить курьера —</option>
                {list.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </li>
          ))}
          {!active.length && <li className="text-sm text-neutral-400 text-center py-6">Нет заказов в доставке</li>}
        </ul>
      </div>
    </div>
  );
}

function Zones() {
  const [list, setList] = useState<any[]>([]);
  const [draft, setDraft] = useState({ name: "", cost: 0, min_order: 0, free_from: 0 });

  async function load() {
    const { data } = await supabase.from("delivery_zones").select("*").order("sort_order");
    setList(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!draft.name) return;
    const { error } = await supabase.from("delivery_zones").insert({
      ...draft, free_from: draft.free_from || null,
    });
    if (error) return toast.error(error.message);
    setDraft({ name: "", cost: 0, min_order: 0, free_from: 0 }); load();
  }
  async function update(id: string, patch: any) {
    await supabase.from("delivery_zones").update(patch).eq("id", id); load();
  }
  async function del(id: string) {
    if (!confirm("Удалить зону?")) return;
    await supabase.from("delivery_zones").delete().eq("id", id); load();
  }

  return (
    <div className="bg-white rounded-3xl p-5">
      <div className="grid grid-cols-12 gap-2 mb-5">
        <input className={inp + " col-span-4"} placeholder="Район / зона" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input type="number" className={inp + " col-span-2"} placeholder="Доставка ₽" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })} />
        <input type="number" className={inp + " col-span-2"} placeholder="Мин.заказ" value={draft.min_order} onChange={(e) => setDraft({ ...draft, min_order: Number(e.target.value) })} />
        <input type="number" className={inp + " col-span-2"} placeholder="Бесплатно от" value={draft.free_from} onChange={(e) => setDraft({ ...draft, free_from: Number(e.target.value) })} />
        <button onClick={add} className="col-span-2 rounded-xl bg-primary text-white font-bold">+ Добавить</button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500 border-b">
          <tr><th className="py-2">Зона</th><th>Стоимость</th><th>Мин. заказ</th><th>Бесплатно от</th><th>Активна</th><th></th></tr>
        </thead>
        <tbody>
          {list.map((z) => (
            <tr key={z.id} className="border-b">
              <td className="py-2 font-semibold">{z.name}</td>
              <td><input type="number" defaultValue={z.cost} onBlur={(e) => update(z.id, { cost: Number(e.target.value) })} className="w-20 px-2 py-1 border rounded" /> ₽</td>
              <td><input type="number" defaultValue={z.min_order} onBlur={(e) => update(z.id, { min_order: Number(e.target.value) })} className="w-24 px-2 py-1 border rounded" /> ₽</td>
              <td><input type="number" defaultValue={z.free_from ?? ""} onBlur={(e) => update(z.id, { free_from: e.target.value ? Number(e.target.value) : null })} className="w-24 px-2 py-1 border rounded" /> ₽</td>
              <td><input type="checkbox" checked={z.is_active} onChange={(e) => update(z.id, { is_active: e.target.checked })} /></td>
              <td><button onClick={() => del(z.id)} className="text-red-500 text-xs">Удалить</button></td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={6} className="py-8 text-center text-neutral-400">Зоны не заданы</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 outline-none focus:border-primary";
