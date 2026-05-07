import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsAdmin,
});

type Settings = {
  delivery_cost: number;
  free_delivery_from: number;
  min_order: number;
  work_hours: string;
  phone: string;
};

const DEFAULT: Settings = {
  delivery_cost: 150,
  free_delivery_from: 1000,
  min_order: 500,
  work_hours: "10:00–22:00",
  phone: "+7 913 286 92-84",
};

function SettingsAdmin() {
  const [s, setS] = useState<Settings>(DEFAULT);
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  async function load() {
    const { data } = await supabase.from("settings").select("*").eq("key", "general").maybeSingle();
    if (data?.value) setS({ ...DEFAULT, ...(data.value as any) });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, profiles:user_id(full_name, phone)")
      .eq("role", "admin");
    setAdmins(roles ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const { error } = await supabase.from("settings").upsert({ key: "general", value: s as any });
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-extrabold mb-6">Настройки</h1>

      <div className="bg-white rounded-3xl p-6 space-y-4 mb-6">
        <h2 className="font-extrabold text-lg">Доставка и заказы</h2>
        <Field label="Стоимость доставки, ₽">
          <input type="number" className={inp} value={s.delivery_cost} onChange={(e) => setS({ ...s, delivery_cost: Number(e.target.value) })} />
        </Field>
        <Field label="Бесплатная доставка от, ₽">
          <input type="number" className={inp} value={s.free_delivery_from} onChange={(e) => setS({ ...s, free_delivery_from: Number(e.target.value) })} />
        </Field>
        <Field label="Минимальная сумма заказа, ₽">
          <input type="number" className={inp} value={s.min_order} onChange={(e) => setS({ ...s, min_order: Number(e.target.value) })} />
        </Field>
        <Field label="Часы работы">
          <input className={inp} value={s.work_hours} onChange={(e) => setS({ ...s, work_hours: e.target.value })} />
        </Field>
        <Field label="Телефон">
          <input className={inp} value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} />
        </Field>
        <button onClick={save} className="px-6 py-2.5 rounded-full bg-primary text-white font-bold">Сохранить</button>
      </div>

      <div className="bg-white rounded-3xl p-6">
        <h2 className="font-extrabold text-lg mb-4">Администраторы</h2>
        <div className="space-y-2 mb-4">
          {admins.map((a: any) => (
            <div key={a.user_id} className="flex justify-between items-center bg-neutral-50 rounded-xl px-4 py-3">
              <div>
                <div className="font-semibold">{a.profiles?.full_name || "Без имени"}</div>
                <div className="text-xs text-neutral-500">{a.profiles?.phone || a.user_id}</div>
              </div>
              <span className="text-xs text-primary font-semibold">admin</span>
            </div>
          ))}
          {!admins.length && <div className="text-sm text-neutral-400">Пока только вы</div>}
        </div>
        <p className="text-xs text-neutral-500">
          Чтобы добавить админа: пользователь регистрируется на /login, затем вы добавляете запись в таблицу <code className="bg-neutral-100 px-1 rounded">user_roles</code> с ролью <code className="bg-neutral-100 px-1 rounded">admin</code>.
        </p>
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-primary outline-none";
function Field({ label, children }: any) {
  return <label className="block"><span className="text-sm text-neutral-600 block mb-1">{label}</span>{children}</label>;
}
