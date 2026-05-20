import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminRole, branchName } from "@/lib/admin-role";

export const Route = createFileRoute("/admin/kanban")({ component: Kanban });

const COLS = [
  { key: "new", label: "Новый", color: "bg-blue-100 border-blue-300" },
  { key: "confirmed", label: "Подтверждён", color: "bg-purple-100 border-purple-300" },
  { key: "cooking", label: "Готовится", color: "bg-amber-100 border-amber-300" },
  { key: "delivering", label: "Доставляется", color: "bg-cyan-100 border-cyan-300" },
  { key: "done", label: "Выполнен", color: "bg-green-100 border-green-300" },
] as const;

const NEXT: Record<string, string> = {
  new: "confirmed", confirmed: "cooking", cooking: "delivering", delivering: "done",
};

function Kanban() {
  const [orders, setOrders] = useState<any[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const { isSuper, branchId, branches } = useAdminRole();

  async function load() {
    let q = supabase.from("orders")
      .select("id,number,customer_name,phone,address,total,status,payment_method,payment_status,delivery_type,comment,created_at,courier_id,branch_id,kitchen_printed_at,paid_at")
      .is("deleted_at", null)
      .in("status", ["new", "confirmed", "cooking", "delivering"])
      .order("created_at", { ascending: true });
    if (isSuper && filterBranch !== "all") q = q.eq("branch_id", filterBranch);
    const { data } = await q;
    const list = data ?? [];
    setOrders(list);
    list.forEach((o: any) => knownIds.current.add(o.id));
  }

  function printKitchen(o: any) {
    if (o.kitchen_printed_at && !confirm("Чек уже печатался. Напечатать ещё раз?")) return;
    window.open(`/print/kitchen/${o.id}`, "_blank", "width=420,height=720");
    setTimeout(load, 1500);
  }

  async function markPaid(o: any) {
    const num = prompt("Номер фискального чека (можно оставить пустым):") ?? "";
    const { error } = await (supabase.from("orders") as any)
      .update({ payment_status: "paid", paid_at: new Date().toISOString(), fiscal_receipt_number: num || null })
      .eq("id", o.id);
    if (error) return toast.error(error.message);
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase.from("order_changes") as any).insert({
      order_id: o.id, user_id: user?.id ?? null, action: "paid",
      details: { fiscal_receipt_number: num || null },
    });
    toast.success("Оплата принята");
    load();
  }

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    const ch = supabase.channel("kanban-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p: any) => {
        if (p.eventType === "INSERT" && !knownIds.current.has(p.new.id)) {
          if (soundOn) audioRef.current?.play().catch(() => {});
          toast.success(`Новый заказ #${p.new.number}`);
        }
        load();
      }).subscribe();
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [soundOn, isSuper, filterBranch]);

  async function move(id: string, status: string) {
    const patch: any = { status };
    if (status === "confirmed") patch.confirmed_at = new Date().toISOString();
    if (status === "done") patch.done_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  async function cancel(id: string) {
    if (!confirm("Отменить заказ?")) return;
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    load();
  }

  function elapsed(iso: string) {
    const sec = Math.floor((now - new Date(iso).getTime()) / 1000);
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src="https://cdn.jsdelivr.net/gh/akx/Notifications@master/sounds/bell.mp3" preload="auto" />
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Канбан заказов</h1>
          {!isSuper && branchId && (
            <div className="text-sm text-neutral-500 mt-1">Филиал: {branchName(branches, branchId)}</div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isSuper && (
            <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
              className="text-sm font-semibold bg-white px-4 py-2 rounded-full border">
              <option value="all">Все филиалы</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm font-semibold bg-white px-4 py-2 rounded-full">
            <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
            🔔 Звук на новые заказы
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {COLS.map((col) => {
          const list = orders.filter((o) => o.status === col.key);
          return (
            <div key={col.key} className={`rounded-2xl border-2 ${col.color} p-3 min-h-[400px]`}>
              <div className="font-extrabold mb-3 px-1 flex justify-between">
                <span>{col.label}</span>
                <span className="text-xs bg-white/70 px-2 rounded-full">{list.length}</span>
              </div>
              <div className="space-y-3">
                {list.map((o) => {
                  const sec = (now - new Date(o.created_at).getTime()) / 1000;
                  const urgent = sec > 1800;
                  return (
                    <div key={o.id} className={`bg-white rounded-xl p-3 shadow-sm ${urgent ? "ring-2 ring-red-400" : ""}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-extrabold">#{o.number}</div>
                        <div className={`text-xs font-mono font-bold ${urgent ? "text-red-600" : "text-neutral-500"}`}>
                          {elapsed(o.created_at)}
                        </div>
                      </div>
                      {isSuper && (
                        <div className="text-[10px] uppercase tracking-wide text-neutral-400 mb-0.5">{branchName(branches, o.branch_id)}</div>
                      )}
                      <div className="text-sm font-semibold truncate">{o.customer_name}</div>
                      <div className="text-xs text-neutral-500 truncate">{o.phone}</div>
                      {o.address && <div className="text-xs text-neutral-500 truncate mt-1">📍 {o.address}</div>}
                      {o.comment && <div className="text-xs text-amber-700 truncate mt-1">💬 {o.comment}</div>}
                      <div className="text-base font-extrabold mt-2 text-primary flex items-center gap-2">
                        {Number(o.total)} ₽
                        {o.payment_status === "paid" ? (
                          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">ОПЛАЧЕН</span>
                        ) : (
                          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">НЕ ОПЛАЧЕН</span>
                        )}
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {NEXT[o.status] && (
                          <button onClick={() => move(o.id, NEXT[o.status])}
                            className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg bg-primary text-white text-xs font-bold">→ {COLS.find(c => c.key === NEXT[o.status])?.label}</button>
                        )}
                        <button onClick={() => printKitchen(o)} title="Печать кухонного чека"
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold ${o.kitchen_printed_at ? "bg-neutral-100 text-neutral-500" : "bg-amber-500 text-white"}`}>🖨</button>
                        {o.payment_status !== "paid" && (
                          <button onClick={() => markPaid(o)} title="Принять оплату"
                            className="px-2 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold">💰</button>
                        )}
                        <button onClick={() => cancel(o.id)}
                          className="px-2 py-1.5 rounded-lg bg-neutral-100 text-xs">✕</button>
                      </div>
                    </div>
                  );
                })}
                {!list.length && <div className="text-xs text-center text-neutral-400 py-6">пусто</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
