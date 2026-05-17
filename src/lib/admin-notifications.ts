import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Plays a short notification "beep" using WebAudio (no asset needed).
function beep() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    g.gain.value = 0.001;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    o.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close(), 800);
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
