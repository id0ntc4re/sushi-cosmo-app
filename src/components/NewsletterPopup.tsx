import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ruError } from "@/lib/errors";

const KEY = "kosmosushi_newsletter_v1";

export function NewsletterPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Укажите корректный email");
    setBusy(true);
    const { error } = await supabase.from("newsletter_subscribers").insert({ email });
    setBusy(false);
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    const code = "WELCOME10";
    toast.success(`Промокод ${code} — −10% на первый заказ`, { duration: 8000 });
    close(true);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 grid place-items-center p-4 animate-fade-in" onClick={() => close(true)}>
      <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
        <button onClick={() => close(true)} className="absolute top-3 right-3 h-9 w-9 rounded-full hover:bg-neutral-100 text-2xl">×</button>
        <div className="text-5xl mb-3">🎁</div>
        <h3 className="text-2xl font-extrabold mb-2">−10% на первый заказ</h3>
        <p className="text-neutral-600 mb-5">Подпишитесь на рассылку и получите промокод на скидку, а ещё первыми узнавайте об акциях.</p>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none" />
          <button disabled={busy} className="w-full py-3 rounded-full bg-primary text-white font-bold hover:opacity-90 disabled:opacity-50">
            {busy ? "Отправляем…" : "Получить скидку"}
          </button>
        </form>
        <p className="text-xs text-neutral-400 mt-3 text-center">Никакого спама. Отписаться можно в любой момент.</p>
      </div>
    </div>
  );
}
