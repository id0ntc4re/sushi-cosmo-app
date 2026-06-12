import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ruError } from "@/lib/errors";

const KEY = "kosmosushi_newsletter_v1";
const VK_URL = "https://vk.com/cosmosushi";

export function NewsletterPopup() {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    const t = setTimeout(() => setOpen(true), 15000);
    return () => clearTimeout(t);
  }, []);

  function close(remember = false) {
    setOpen(false);
    if (remember) localStorage.setItem(KEY, "1");
  }

  function openVk() {
    window.open(VK_URL, "_blank", "noopener,noreferrer");
    setVisited(true);
  }

  async function claim() {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("issue_vk_welcome_promo");
    setBusy(false);
    if (error || !data) return toast.error(ruError(error) || "Не удалось получить промокод");
    const newCode = data as string;
    setCode(newCode);
    try {
      await navigator.clipboard.writeText(newCode);
      toast.success(`Промокод ${newCode} скопирован — −10% на первый заказ`, { duration: 10000 });
    } catch {
      toast.success(`Ваш промокод: ${newCode}`, { duration: 12000 });
    }
    localStorage.setItem(KEY, "1");
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 grid place-items-center p-4 animate-fade-in" onClick={() => close(true)}>
      <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
        <button onClick={() => close(true)} aria-label="Закрыть" className="absolute top-3 right-3 h-9 w-9 rounded-full hover:bg-neutral-100 text-2xl">×</button>
        <div className="text-5xl mb-3">🎁</div>
        <h3 className="text-2xl font-extrabold mb-2">−10% на первый заказ</h3>
        <p className="text-neutral-600 mb-5">
          Подпишитесь на нашу группу ВКонтакте и заберите персональный промокод. Первыми узнавайте об акциях и новинках.
        </p>

        {code ? (
          <div className="space-y-3">
            <div className="rounded-2xl border-2 border-dashed border-primary bg-primary/5 p-5 text-center">
              <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Ваш промокод</div>
              <div className="text-3xl font-extrabold tracking-widest text-primary select-all">{code}</div>
              <div className="text-xs text-neutral-500 mt-2">−10% · одноразовый · действует 30 дней</div>
            </div>
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(code); toast.success("Скопировано"); } catch {} }}
              className="w-full py-3 rounded-full border border-neutral-200 font-semibold hover:bg-neutral-50"
            >
              Скопировать ещё раз
            </button>
            <button onClick={() => close(true)} className="w-full py-3 rounded-full bg-primary text-white font-bold hover:opacity-90">
              За покупками
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={openVk}
              className="w-full py-3 rounded-full bg-[#0077FF] text-white font-bold hover:opacity-90 flex items-center justify-center gap-2"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12.79 16.46c-5.06 0-8.21-3.6-8.34-9.6h2.55c.09 4.4 2.07 6.27 3.66 6.66V6.86h2.43v3.66c1.56-.17 3.2-1.97 3.75-3.66h2.42c-.42 2.09-2.16 3.89-3.4 4.63 1.24.6 3.23 2.17 3.99 5h-2.66c-.6-1.87-2.1-3.32-4.1-3.52v3.52h-.3z"/>
              </svg>
              Подписаться на ВКонтакте
            </button>

            <button
              onClick={claim}
              disabled={!visited || busy}
              className="w-full mt-3 py-3 rounded-full bg-primary text-white font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "Генерируем…" : visited ? "Я подписался — получить промокод" : "Сначала подпишитесь"}
            </button>

            <p className="text-xs text-neutral-400 mt-3 text-center">Промокод одноразовый, действует 30 дней.</p>
          </>
        )}
      </div>
    </div>
  );
}
