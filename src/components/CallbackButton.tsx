import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Phone, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ruError } from "@/lib/errors";

type Branch = { id: string; name: string };

export function CallbackButton() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("branches").select("id,name").eq("is_active", true).order("sort_order")
      .then(({ data }) => {
        const list = (data ?? []) as Branch[];
        setBranches(list);
        if (list[0]) setBranchId(list[0].id);
      });
  }, []);

  const hidden = path.startsWith("/admin") || path.startsWith("/login") || path.startsWith("/checkout");
  if (hidden) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Введите имя");
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Введите корректный телефон");
    setBusy(true);
    const { error } = await supabase.from("callback_requests").insert({
      name: name.trim(), phone: phone.trim(), branch_id: branchId || null,
    });
    setBusy(false);
    if (error) return toast.error(ruError(error));
    toast.success("Заявка принята! Мы перезвоним в ближайшее время.");
    setOpen(false); setName(""); setPhone("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full bg-emerald-500 text-white shadow-2xl grid place-items-center hover:scale-105 active:scale-95 transition"
        aria-label="Заказать звонок"
      >
        <Phone className="h-6 w-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/60 grid place-items-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative">
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 h-10 w-10 grid place-items-center rounded-full hover:bg-neutral-100">
              <X className="h-5 w-5" />
            </button>
            <div className="text-4xl mb-3">📞</div>
            <h3 className="text-2xl font-extrabold mb-1">Заказать звонок</h3>
            <p className="text-neutral-500 text-sm mb-5">Оставьте контакты — администратор перезвонит в ближайшее время.</p>
            <form onSubmit={submit} className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" maxLength={100}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 ___ ___ __ __" type="tel" maxLength={20}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none" />
              {branches.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1.5 ml-1">Выберите филиал</label>
                  <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none bg-white">
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <button disabled={busy} className="w-full py-3 rounded-full bg-primary text-white font-bold hover:opacity-90 disabled:opacity-50">
                {busy ? "Отправляем…" : "Перезвоните мне"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
