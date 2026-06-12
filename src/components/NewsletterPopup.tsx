import { useEffect, useState } from "react";
import { toast } from "sonner";

const KEY = "kosmosushi_newsletter_v1";
const PROMO_CODE = "WELCOME10";
const VK_URL = "https://vk.com/cosmosushi";

export function NewsletterPopup() {
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);

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
    try {
      await navigator.clipboard.writeText(PROMO_CODE);
      toast.success(`Промокод ${PROMO_CODE} скопирован — −10% на первый заказ`, { duration: 8000 });
    } catch {
      toast.success(`Ваш промокод: ${PROMO_CODE} — −10% на первый заказ`, { duration: 10000 });
    }
    close(true);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 grid place-items-center p-4 animate-fade-in" onClick={() => close(true)}>
      <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
        <button onClick={() => close(true)} aria-label="Закрыть" className="absolute top-3 right-3 h-9 w-9 rounded-full hover:bg-neutral-100 text-2xl">×</button>
        <div className="text-5xl mb-3">🎁</div>
        <h3 className="text-2xl font-extrabold mb-2">−10% на первый заказ</h3>
        <p className="text-neutral-600 mb-5">
          Подпишитесь на нашу группу ВКонтакте и заберите промокод на скидку. Первыми узнавайте об акциях и новинках.
        </p>

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
          disabled={!visited}
          className="w-full mt-3 py-3 rounded-full bg-primary text-white font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {visited ? "Я подписался — получить промокод" : "Сначала подпишитесь"}
        </button>

        <p className="text-xs text-neutral-400 mt-3 text-center">Промокод действует на первый заказ.</p>
      </div>
    </div>
  );
}
