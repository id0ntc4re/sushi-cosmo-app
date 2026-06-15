import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { resolveZoneSmart, detectBranchByAddress } from "@/lib/geocode.functions";
import ZoneMapEditor from "@/components/ZoneMapEditor";

export const Route = createFileRoute("/admin/couriers")({ component: Page });

function Page() {
  const [tab, setTab] = useState<"couriers" | "zones" | "check">("couriers");
  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Курьеры и зоны доставки</h1>
      <div className="flex gap-2 mb-5">
        <Tab on={tab === "couriers"} onClick={() => setTab("couriers")}>🛵 Курьеры</Tab>
        <Tab on={tab === "zones"} onClick={() => setTab("zones")}>📍 Зоны</Tab>
        <Tab on={tab === "check"} onClick={() => setTab("check")}>🧪 Проверка адреса</Tab>
      </div>
      {tab === "couriers" ? <Couriers /> : tab === "zones" ? <Zones /> : <AddressChecker />}
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
      .is("deleted_at", null)
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

const KEMEROVO_DISTRICTS = ["Центральный", "Ленинский", "Кировский", "Рудничный", "Заводский"];

function Zones() {
  const [list, setList] = useState<any[]>([]);
  const [draft, setDraft] = useState({ name: "", cost: 0, min_order: 0, free_from: 0, streets: "", districts: [] as string[] });
  const [mapZone, setMapZone] = useState<any | null>(null);

  async function load() {
    const { data } = await supabase.from("delivery_zones").select("*").order("sort_order");
    setList(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!draft.name) return;
    const { error } = await (supabase.from("delivery_zones") as any).insert({
      name: draft.name,
      cost: draft.cost,
      min_order: draft.min_order,
      free_from: draft.free_from || null,
      streets: draft.streets || null,
      districts: draft.districts.length ? draft.districts : null,
    });
    if (error) return toast.error(error.message);
    setDraft({ name: "", cost: 0, min_order: 0, free_from: 0, streets: "", districts: [] }); load();
  }
  async function update(id: string, patch: any) {
    await (supabase.from("delivery_zones") as any).update(patch).eq("id", id); load();
  }
  async function del(id: string) {
    if (!confirm("Удалить зону?")) return;
    await supabase.from("delivery_zones").delete().eq("id", id); load();
  }

  function toggleDraftDistrict(d: string) {
    setDraft((s) => ({
      ...s,
      districts: s.districts.includes(d) ? s.districts.filter((x) => x !== d) : [...s.districts, d],
    }));
  }

  function toggleZoneDistrict(z: any, d: string) {
    const cur: string[] = Array.isArray(z.districts) ? z.districts : [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    update(z.id, { districts: next.length ? next : null });
  }

  return (
    <div className="bg-white rounded-3xl p-5">
      <p className="text-xs text-neutral-500 mb-3">
        Зона определяется по <b>названию улицы</b> в адресе клиента. Для улиц, проходящих
        через несколько районов (Ленина, Пролетарская и т.п.) — отметьте <b>районы</b> зоны:
        тогда при неоднозначности система уточнит зону через геокодер.
      </p>
      <div className="grid grid-cols-12 gap-3 mb-3">
        <Field className="col-span-3" label="Название зоны" hint="например: Центральный, Рудничный, Лесная Поляна">
          <input className={inp} placeholder="Район / зона" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field className="col-span-2" label="Доставка, ₽" hint="сколько берём за доставку в эту зону">
          <input placeholder="0" type="number" className={inp} value={(draft.cost) || ""} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })} />
        </Field>
        <Field className="col-span-2" label="Мин. заказ, ₽" hint="ниже этой суммы заказ оформить нельзя">
          <input placeholder="0" type="number" className={inp} value={(draft.min_order) || ""} onChange={(e) => setDraft({ ...draft, min_order: Number(e.target.value) })} />
        </Field>
        <Field className="col-span-2" label="Бесплатно от, ₽" hint="доставка станет 0 ₽ при заказе от этой суммы (пусто = всегда платная)">
          <input placeholder="0" type="number" className={inp} value={(draft.free_from) || ""} onChange={(e) => setDraft({ ...draft, free_from: Number(e.target.value) })} />
        </Field>
        <div className="col-span-3 flex items-end">
          <button onClick={add} className="w-full h-[42px] rounded-xl bg-primary text-white font-bold">+ Добавить зону</button>
        </div>
      </div>
      <div className="mb-3">
        <div className="text-xs font-semibold text-neutral-600 mb-1">Улицы зоны</div>
        <textarea className={inp + " min-h-[60px]"} placeholder="через запятую или с новой строки: Шахтёров, Красноармейская, Притомский"
          value={draft.streets} onChange={(e) => setDraft({ ...draft, streets: e.target.value })} />
        <div className="text-[11px] text-neutral-400 mt-1">По этим названиям система определяет зону автоматически по адресу клиента.</div>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        <span className="text-xs text-neutral-500 self-center mr-1">Районы:</span>
        {KEMEROVO_DISTRICTS.map((d) => (
          <button key={d} type="button" onClick={() => toggleDraftDistrict(d)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${draft.districts.includes(d) ? "bg-primary text-white border-primary" : "bg-white border-neutral-300 text-neutral-700"}`}>
            {d}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.map((z) => (
          <div key={z.id} className="border rounded-2xl p-3">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3 font-semibold">{z.name}</div>
              <div className="col-span-2">
                <input type="number" defaultValue={z.cost} onBlur={(e) => update(z.id, { cost: Number(e.target.value) })} className="w-full px-2 py-1 border rounded" />
                <div className="text-[10px] text-neutral-400">Доставка ₽</div>
              </div>
              <div className="col-span-2">
                <input type="number" defaultValue={z.min_order} onBlur={(e) => update(z.id, { min_order: Number(e.target.value) })} className="w-full px-2 py-1 border rounded" />
                <div className="text-[10px] text-neutral-400">Мин. заказ ₽</div>
              </div>
              <div className="col-span-2">
                <input type="number" defaultValue={z.free_from ?? ""} onBlur={(e) => update(z.id, { free_from: e.target.value ? Number(e.target.value) : null })} className="w-full px-2 py-1 border rounded" />
                <div className="text-[10px] text-neutral-400">Бесплатно от ₽</div>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={z.is_active} onChange={(e) => update(z.id, { is_active: e.target.checked })} /> активна
                </label>
                <button onClick={() => del(z.id)} className="text-red-500 text-xs ml-auto">Удалить</button>
              </div>
              <div className="col-span-1" />
            </div>
            <textarea
              defaultValue={z.streets ?? ""}
              onBlur={(e) => update(z.id, { streets: e.target.value || null })}
              placeholder="Улицы (через запятую или с новой строки): Шахтёров, Притомский, Ленина"
              className="w-full mt-2 px-3 py-2 rounded-xl border border-neutral-200 outline-none focus:border-primary text-sm min-h-[50px]"
            />
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-neutral-500">Районы:</span>
              {KEMEROVO_DISTRICTS.map((d) => {
                const on = Array.isArray(z.districts) && z.districts.includes(d);
                return (
                  <button key={d} type="button" onClick={() => toggleZoneDistrict(z, d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${on ? "bg-primary text-white border-primary" : "bg-white border-neutral-300 text-neutral-700"}`}>
                    {d}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setMapZone(z)}
                className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold border ${Array.isArray(z.polygon) && z.polygon.length >= 3 ? "bg-emerald-500 text-white border-emerald-500" : "bg-white border-neutral-300 text-neutral-700"}`}
              >
                🗺 {Array.isArray(z.polygon) && z.polygon.length >= 3 ? "Полигон задан · изменить" : "Нарисовать на карте"}
              </button>
            </div>
          </div>
        ))}
        {!list.length && <div className="py-8 text-center text-neutral-400">Зоны не заданы</div>}
      </div>

      <ZoneMapEditor
        open={!!mapZone}
        onClose={() => setMapZone(null)}
        zoneName={mapZone?.name ?? ""}
        initialPolygon={Array.isArray(mapZone?.polygon) ? mapZone.polygon : null}
        allZones={list.filter((z) => z.id !== mapZone?.id).map((z) => ({ id: z.id, name: z.name, polygon: Array.isArray(z.polygon) ? z.polygon : null }))}
        onSave={async (poly: { lat: number; lng: number }[] | null) => {
          if (!mapZone) return;
          await update(mapZone.id, { polygon: poly });
          toast.success(poly ? "Полигон сохранён" : "Полигон удалён");
        }}
      />
    </div>
  );
}


const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 outline-none focus:border-primary";

function AddressChecker() {
  const resolve = useServerFn(resolveZoneSmart);
  const detect = useServerFn(detectBranchByAddress);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ zone: any; branch: any } | null>(null);
  const createdOrder: { id: string; number: number } | null = null;

  async function check() {
    if (address.trim().length < 3) return;
    setBusy(true); setRes(null);
    try {
      const [z, b] = await Promise.all([
        resolve({ data: { address } }),
        detect({ data: { address } }),
      ]);
      setRes({ zone: z, branch: b });
    } catch (e: any) {
      toast.error(e?.message ?? "Ошибка проверки");
    } finally {
      setBusy(false);
    }
  }

  const samples = [
    "Шахтёров 68", "Ленина 5", "Ленина 150", "Бульвар Строителей 21",
    "Притомский проспект 25", "Кирова 41",
  ];

  return (
    <div className="bg-white rounded-3xl p-5 space-y-5">
      <div>
        <p className="text-xs text-neutral-500 mb-2">
          Проверьте адрес — система покажет район, филиал и зону доставки.
        </p>
        <div className="flex gap-2">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder="например: Ленина 150"
            className={inp + " flex-1"}
          />
          <button onClick={check} disabled={busy} className="px-5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">
            {busy ? "..." : "Проверить"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs text-neutral-400 self-center">Примеры:</span>
          {samples.map((s) => (
            <button key={s} onClick={() => setAddress(s)} className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200">
              {s}
            </button>
          ))}
        </div>
      </div>

      {res && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-2xl p-4">
            <div className="text-xs text-neutral-500 mb-2">📍 Зона доставки</div>
            {(res.zone as any)?.ok ? (
              <div className="space-y-1 text-sm">
                <div><b>Зона:</b> {(res.zone as any).zoneName}</div>
                <div><b>Стоимость:</b> {(res.zone as any).cost} ₽</div>
                <div><b>Мин. заказ:</b> {(res.zone as any).minOrder} ₽</div>
                {(res.zone as any).freeFrom != null && <div><b>Бесплатно от:</b> {(res.zone as any).freeFrom} ₽</div>}
                {(res.zone as any).matchedStreet && <div className="text-xs text-neutral-500">Найдена улица: «{(res.zone as any).matchedStreet}»</div>}
                {(res.zone as any).district && <div className="text-xs text-neutral-500">Район: {(res.zone as any).district}</div>}
                <div className="text-[11px] text-neutral-400 mt-1">источник: {(res.zone as any).source}</div>
              </div>
            ) : (
              <div className="text-sm text-red-500">Зона не определена ({(res.zone as any)?.reason ?? "?"})</div>
            )}
          </div>
          <div className="border rounded-2xl p-4">
            <div className="text-xs text-neutral-500 mb-2">🏠 Филиал</div>
            {(res.branch as any)?.ok ? (
              <div className="space-y-1 text-sm">
                <div><b>Филиал:</b> {(res.branch as any).label}</div>
                <div><b>Расстояние:</b> {(res.branch as any).distanceKm} км</div>
                {(res.branch as any).district && <div><b>Район:</b> {(res.branch as any).district}</div>}
                <div className="text-xs text-neutral-500">Адрес: {(res.branch as any).formatted}</div>
              </div>
            ) : (
              <div className="text-sm text-red-500">Филиал не определён ({(res.branch as any)?.reason ?? "?"})</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-xs font-semibold text-neutral-600 mb-1">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-neutral-400 mt-1 leading-tight">{hint}</div>}
    </label>
  );
}
