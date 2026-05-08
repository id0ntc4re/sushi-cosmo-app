import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Flash = { enabled: boolean; title: string; percent: number; ends_at: string | null };

export function FlashSaleBanner() {
  const [flash, setFlash] = useState<Flash | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "flash_sale").maybeSingle().then(({ data }) => {
      if (data?.value) setFlash(data.value as Flash);
    });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!flash || !flash.enabled || !flash.ends_at) return null;
  const left = new Date(flash.ends_at).getTime() - now;
  if (left <= 0) return null;

  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-white">
      <div className="mx-auto max-w-[1280px] px-6 py-2.5 flex items-center justify-center gap-3 text-sm font-bold flex-wrap">
        <span className="text-base">🔥</span>
        <span>{flash.title}</span>
        <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur font-mono tabular-nums">
          до конца: {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      </div>
    </div>
  );
}
