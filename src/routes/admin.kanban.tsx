import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminRole, branchName } from "@/lib/admin-role";
import { printKitchenReceipt } from "@/lib/kitchen-print";
import { FiscalReceiptModal } from "@/components/FiscalReceiptModal";

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
  const [fiscalOrderId, setFiscalOrderId] = useState<string | null>(null);
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

  async function printKitchen(o: any) {
    if (o.kitchen_printed_at && !confirm("Чек уже печатался. Напечатать ещё раз?")) return;
    try {
      await printKitchenReceipt(o.id);
      setTimeout(load, 500);
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось открыть печать");
    }
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
            <div key={col.key} className={`rounded-xl border-2 ${col.color} p-2 min-h-[360px]`}>
              <div className="font-extrabold mb-2 px-1 flex justify-between text-sm">
                <span>{col.label}</span>
                <span className="text-[10px] bg-white/70 px-1.5 rounded-full">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((o) => {
                  const sec = (now - new Date(o.created_at).getTime()) / 1000;
                  const urgent = sec > 1800;
                  return (
                    <div key={o.id} className={`bg-white rounded-lg p-2 shadow-sm ${urgent ? "ring-2 ring-red-400" : ""}`}>
                      <div className="flex justify-between items-start">
                        <div className="font-extrabold text-sm">#{o.number}</div>
                        <div className={`text-[10px] font-mono font-bold ${urgent ? "text-red-600" : "text-neutral-500"}`}>
                          {elapsed(o.created_at)}
                        </div>
                      </div>
                      {isSuper && (
                        <div className="text-[9px] uppercase tracking-wide text-neutral-400 truncate">{branchName(branches, o.branch_id)}</div>
                      )}
                      <div className="text-xs font-semibold truncate">{o.customer_name}</div>
                      <div className="text-[11px] text-neutral-500 truncate">{o.phone}</div>
                      {o.address && <div className="text-[11px] text-neutral-500 truncate">📍 {o.address}</div>}
                      {o.comment && <div className="text-[11px] text-amber-700 truncate">💬 {o.comment}</div>}
                      <div className="text-sm font-extrabold mt-1 text-primary flex items-center gap-1.5 flex-wrap">
                        {Number(o.total)} ₽
                        {o.payment_status === "paid" ? (
                          <span
                            title={o.payment_method === "cash" ? "Оплачено наличными" : o.payment_method === "card_courier" ? "Оплачено картой" : o.payment_method === "card_online" ? "Оплачено онлайн" : ""}
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                              o.payment_method === "cash"
                                ? "bg-emerald-100 text-emerald-700"
                                : o.payment_method === "card_courier"
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-violet-100 text-violet-700"
                            }`}>
                            {o.payment_method === "cash" ? "💵" : o.payment_method === "card_courier" ? "💳" : "🌐"}
                          </span>
                        ) : (
                          <span title="Не оплачено" className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] bg-red-100 text-red-700">💵</span>
                        )}
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {NEXT[o.status] && (
                          <button onClick={() => move(o.id, NEXT[o.status])}
                            className="flex-1 min-w-[90px] px-1.5 py-1 rounded-md bg-primary text-white text-[10px] font-bold">→ {COLS.find(c => c.key === NEXT[o.status])?.label}</button>
                        )}
                        <button onClick={() => printKitchen(o)} title="Печать кухонного чека"
                          className={`px-1.5 py-1 rounded-md text-[10px] font-bold ${o.kitchen_printed_at ? "bg-neutral-100 text-neutral-500" : "bg-amber-500 text-white"}`}>🖨</button>
                        {o.payment_status !== "paid" && (
                          <button onClick={() => openPay(o)} title="Принять оплату"
                            className="px-1.5 py-1 rounded-md bg-green-600 text-white text-[10px] font-bold">💰</button>
                        )}
                        <button onClick={() => cancel(o.id)}
                          className="px-1.5 py-1 rounded-md bg-neutral-100 text-[10px]">✕</button>
                      </div>
                    </div>
                  );
                })}
                {!list.length && <div className="text-[11px] text-center text-neutral-400 py-4">пусто</div>}
              </div>
            </div>
          );
        })}
      </div>

      {payOrder && (() => {
        const total = Number(payOrder.total);
        const given = Number(payCashGiven || 0);
        const change = given >= total ? given - total : 0;
        const insufficient = !!payCashGiven && given < total;
        const appendDigit = (d: string) => setPayCashGiven((v) => (v === "0" ? d : v + d));
        const setQuick = (n: number) => setPayCashGiven(String(n));
        const clearAmount = () => setPayCashGiven("");
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPayOrder(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="text-center text-xl font-extrabold mb-5">Расчёт сдачи · заказ #{payOrder.number}</div>

              <div className="grid grid-cols-[110px_1fr] gap-y-3 gap-x-4 items-center mb-4">
                <div className="text-neutral-600">Итого</div>
                <div className="text-lg font-extrabold text-primary">{total} ₽</div>

                <div className="text-neutral-600">Внесено</div>
                <input
                  type="number" inputMode="decimal" autoFocus
                  value={payCashGiven}
                  onChange={(e) => setPayCashGiven(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  className="px-3 py-2 rounded-md border border-neutral-300 text-lg font-bold w-full"
                />

                <div className="text-neutral-600">Сдача</div>
                <div className={`text-lg font-extrabold ${insufficient ? "text-red-600" : "text-green-700"}`}>
                  {insufficient ? "недостаточно" : `${change.toFixed(2)} ₽`}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {["7","8","9"].map((d) => (
                  <button key={d} onClick={() => appendDigit(d)} className="py-3 rounded-lg border-2 border-neutral-200 text-lg font-bold hover:bg-neutral-50">{d}</button>
                ))}
                <button onClick={() => setQuick(5000)} className="py-3 rounded-lg border-2 border-primary/30 text-primary font-bold hover:bg-primary/5">5000</button>

                {["4","5","6"].map((d) => (
                  <button key={d} onClick={() => appendDigit(d)} className="py-3 rounded-lg border-2 border-neutral-200 text-lg font-bold hover:bg-neutral-50">{d}</button>
                ))}
                <button onClick={() => setQuick(2000)} className="py-3 rounded-lg border-2 border-primary/30 text-primary font-bold hover:bg-primary/5">2000</button>

                {["1","2","3"].map((d) => (
                  <button key={d} onClick={() => appendDigit(d)} className="py-3 rounded-lg border-2 border-neutral-200 text-lg font-bold hover:bg-neutral-50">{d}</button>
                ))}
                <button onClick={() => setQuick(1000)} className="py-3 rounded-lg border-2 border-primary/30 text-primary font-bold hover:bg-primary/5">1000</button>

                <button onClick={() => appendDigit("0")} className="py-3 rounded-lg border-2 border-neutral-200 text-lg font-bold hover:bg-neutral-50">0</button>
                <button onClick={() => setPayCashGiven((v) => v.slice(0, -1))} className="py-3 rounded-lg border-2 border-neutral-200 text-lg font-bold hover:bg-neutral-50">⌫</button>
                <button onClick={clearAmount} className="py-3 rounded-lg border-2 border-red-200 text-red-600 text-lg font-bold hover:bg-red-50">C</button>
                <button onClick={() => setQuick(500)} className="py-3 rounded-lg border-2 border-primary/30 text-primary font-bold hover:bg-primary/5">500</button>
              </div>

              <div className="mb-4">
                <label className="text-xs font-bold text-neutral-600 block mb-1">Номер фискального чека (необязательно)</label>
                <input
                  value={payFiscal}
                  onChange={(e) => setPayFiscal(e.target.value)}
                  placeholder="—"
                  className="w-full px-3 py-2 rounded-md border border-neutral-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => confirmPay("cash")}
                  disabled={insufficient}
                  className="py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold disabled:opacity-40">
                  💵 Наличными
                </button>
                <button
                  onClick={() => confirmPay("card_courier")}
                  className="py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-extrabold">
                  💳 Картой
                </button>
                <button
                  onClick={() => setPayOrder(null)}
                  className="py-3 rounded-lg bg-neutral-100 hover:bg-neutral-200 font-bold">
                  Отмена
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
