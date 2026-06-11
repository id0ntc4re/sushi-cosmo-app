import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/run-writeoff-schedules")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // current time in UTC (DB time_of_day is treated as local time of the deployment / no TZ).
        // We compare HH:MM and run a schedule once per day.
        const now = new Date();
        const hh = String(now.getUTCHours()).padStart(2, "0");
        const mm = String(now.getUTCMinutes()).padStart(2, "0");
        const dow = now.getUTCDay();
        const today = now.toISOString().slice(0, 10);

        const { data: schedules, error } = await supabaseAdmin
          .from("writeoff_schedules")
          .select("*")
          .eq("active", true);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const ran: string[] = [];
        for (const s of schedules ?? []) {
          if (!(s.days_of_week ?? []).includes(dow)) continue;
          const t = String(s.time_of_day ?? "").slice(0, 5);
          if (t > `${hh}:${mm}`) continue; // not yet
          if (s.last_run_at && String(s.last_run_at).slice(0, 10) === today) continue; // already ran today
          await supabaseAdmin.rpc("run_writeoff_schedule", { _schedule_id: s.id });
          ran.push(s.id);
        }

        return new Response(JSON.stringify({ ok: true, ran }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
