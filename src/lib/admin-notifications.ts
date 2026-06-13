import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Максимально громкий сигнал нового заказа: серия "бип-бип-бип"
// через WebAudio с двумя осцилляторами и компрессором (нормализация = громче).
function beep() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 0;
    comp.ratio.value = 20;
    comp.attack.value = 0;
    comp.release.value = 0.1;
    const master = ctx.createGain();
    master.gain.value = 1.0; // максимум до клиппинга
    comp.connect(master);
    master.connect(ctx.destination);

    const beats = 4;
    const beatLen = 0.18;
    const gap = 0.09;
    for (let i = 0; i < beats; i++) {
      const t0 = ctx.currentTime + i * (beatLen + gap);
      // основной тон
      const o1 = ctx.createOscillator();
      o1.type = "square"; o1.frequency.value = 1175; // D6
      // второй тон для богатства/громкости
      const o2 = ctx.createOscillator();
      o2.type = "square"; o2.frequency.value = 1568; // G6
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      o1.connect(g); o2.connect(g); g.connect(comp);
      g.gain.exponentialRampToValueAtTime(1.0, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + beatLen);
      o1.start(t0); o2.start(t0);
      o1.stop(t0 + beatLen + 0.02);
      o2.stop(t0 + beatLen + 0.02);
    }
    const total = beats * (beatLen + gap) + 0.2;
    setTimeout(() => ctx.close().catch(() => {}), total * 1000 + 200);
  } catch {/* ignore */}
}

function notify(title: string, body: string) {
  beep();
  toast.success(title, { description: body, duration: 8000 });
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body, tag: title + body, icon: "/favicon.ico" }); } catch {/* ignore */}
  }
}

/**
 * Subscribes admin sessions to realtime inserts on `orders` and `callback_requests`.
 * - `isSuper`: hears all branches. Otherwise scoped to `branchId`.
 * - Requests browser Notification permission on first mount.
 */
export function useAdminNotifications(opts: { isSuper: boolean; branchId: string | null }) {
  const { isSuper, branchId } = opts;
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isSuper && !branchId) return;

    const matches = (row: { branch_id?: string | null; created_at?: string | null }) => {
      if (row.created_at && new Date(row.created_at).getTime() < startedAt.current - 5000) return false;
      if (isSuper) return true;
      return row.branch_id === branchId;
    };

    const channel = supabase
      .channel("admin-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const r = payload.new as any;
        if (!matches(r)) return;
        notify(`Новый заказ №${r.number ?? ""}`, `${r.customer_name ?? ""} · ${Math.round(Number(r.total) || 0)} ₽`);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "callback_requests" }, (payload) => {
        const r = payload.new as any;
        if (!matches(r)) return;
        notify("Запрос на звонок", `${r.name ?? ""} · ${r.phone ?? ""}`);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isSuper, branchId]);
}
