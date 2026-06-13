import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_RECEIPT, ReceiptSettings, loadReceiptSettings, receiptKey } from "@/lib/receipt-settings";

export const Route = createFileRoute("/admin/receipt")({ component: ReceiptAdmin });

function ReceiptAdmin() {
  const [isSuper, setIsSuper] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [scope, setScope] = useState<"global" | "branch">("global");
  const [s, setS] = useState<ReceiptSettings>(DEFAULT_RECEIPT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roles } = await supabase
        .from("user_roles").select("role,branch_id").eq("user_id", user.id);
      const rs = (roles ?? []) as { role: string; branch_id: string | null }[];
      const sup = rs.some((r) => r.role === "super_admin");
      const admin = rs.find((r) => r.role === "admin");
      setIsSuper(sup);
      const bId = admin?.branch_id ?? null;
      setBranchId(bId);
      if (bId) {
        const { data: b } = await supabase.from("branches").select("name").eq("id", bId).maybeSingle();
        setBranchName(b?.name ?? null);
      }
      const initialScope: "global" | "branch" = sup ? "global" : "branch";
      setScope(initialScope);
      const loaded = await loadCurrent(initialScope, bId);
      setS(loaded);
      setLoading(false);
    })();
  }, []);

  async function loadCurrent(sc: "global" | "branch", bId: string | null) {
    if (sc === "branch" && bId) {
      const { data } = await supabase.from("settings").select("value").eq("key", receiptKey(bId)).maybeSingle();
      if (data?.value) return { ...DEFAULT_RECEIPT, ...(data.value as any) };
      return await loadReceiptSettings(bId);
    }
    const { data } = await supabase.from("settings").select("value").eq("key", "kitchen_receipt").maybeSingle();
    return { ...DEFAULT_RECEIPT, ...((data?.value as any) ?? {}) };
  }

  async function changeScope(sc: "global" | "branch") {
    setScope(sc);
    setLoading(true);
    setS(await loadCurrent(sc, branchId));
    setLoading(false);
  }

  async function save() {
    const key = scope === "branch" && branchId ? receiptKey(branchId) : "kitchen_receipt";
    const { error } = await supabase.from("settings").upsert({ key, value: s as any });
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
  }

  async function resetBranchOverride() {
    if (!branchId) return;
    if (!confirm("Удалить персональные настройки филиала и использовать общие?")) return;
    const { error } = await supabase.from("settings").delete().eq("key", receiptKey(branchId));
    if (error) return toast.error(error.message);
    toast.success("Сброшено");
    setS(await loadCurrent("global", branchId));
  }

  if (loading) return <div className="text-neutral-500">Загрузка…</div>;

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-extrabold mb-2">Настройки печати кухонного чека</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Эти данные печатаются на кухонном чеке (шапка, подвал, состав).
      </p>

      {isSuper && branchId === null ? null : (
        <div className="bg-white rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">Область:</span>
          {isSuper && (
            <button
              onClick={() => changeScope("global")}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${scope === "global" ? "bg-primary text-white" : "bg-neutral-100"}`}
            >Общие (все филиалы)</button>
          )}
          {branchId && (
            <button
              onClick={() => changeScope("branch")}
              className={`px-4 py-2 rounded-full text-sm font-semibold ${scope === "branch" ? "bg-primary text-white" : "bg-neutral-100"}`}
            >Филиал · {branchName ?? "мой филиал"}</button>
          )}
          {scope === "branch" && (
            <button onClick={resetBranchOverride} className="ml-auto text-xs text-red-600 hover:underline">
              Сбросить и использовать общие
            </button>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 space-y-4">
          <h2 className="font-extrabold text-lg">Шапка чека</h2>
          <Field label="Логотип (URL картинки, необязательно)">
            <input className={inp} value={s.logo_url}
              onChange={(e) => setS({ ...s, logo_url: e.target.value })}
              placeholder="https://…/logo.png" />
          </Field>
          <Field label="Название">
            <input className={inp} value={s.name}
              onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <Field label="Поле №1 (например адрес)">
            <input className={inp} value={s.line1}
              onChange={(e) => setS({ ...s, line1: e.target.value })} />
          </Field>
          <Field label="Поле №2">
            <input className={inp} value={s.line2}
              onChange={(e) => setS({ ...s, line2: e.target.value })} />
          </Field>
          <Field label="Поле №3 (например телефон)">
            <input className={inp} value={s.line3}
              onChange={(e) => setS({ ...s, line3: e.target.value })} />
          </Field>

          <h2 className="font-extrabold text-lg pt-2">Подвал</h2>
          <Field label="Сообщение в конце чека">
            <textarea className={`${inp} min-h-[80px]`} value={s.footer}
              onChange={(e) => setS({ ...s, footer: e.target.value })} />
          </Field>

          <h2 className="font-extrabold text-lg pt-2">Что печатать</h2>
          <Toggle label="Таблица позиций (наименование / кол. / сумма)"
            value={s.show_items_table} onChange={(v) => setS({ ...s, show_items_table: v })} />
          <Toggle label="Итог, скидка, к оплате"
            value={s.show_totals} onChange={(v) => setS({ ...s, show_totals: v })} />
          <Toggle label="Данные клиента (адрес, телефон, примечание)"
            value={s.show_customer} onChange={(v) => setS({ ...s, show_customer: v })} />
          <Toggle label="Баллы клиента"
            value={s.show_bonus} onChange={(v) => setS({ ...s, show_bonus: v })} />

          <button onClick={save} className="px-6 py-2.5 rounded-full bg-primary text-white font-bold">
            Сохранить
          </button>
        </div>

        <div>
          <h2 className="font-extrabold text-lg mb-3">Образец</h2>
          <Preview s={s} />
        </div>
      </div>
    </div>
  );
}

function Preview({ s }: { s: ReceiptSettings }) {
  return (
    <div className="bg-white border rounded-2xl p-4 font-mono text-[12px] leading-snug text-black max-w-[320px] mx-auto">
      <div className="text-center">
        {s.logo_url && <img src={s.logo_url} alt="" className="mx-auto max-h-14 mb-2 object-contain" />}
        <div className="text-lg font-extrabold">{s.name || "—"}</div>
        {s.line1 && <div>{s.line1}</div>}
        {s.line2 && <div>{s.line2}</div>}
        {s.line3 && <div>{s.line3}</div>}
      </div>
      <div className="border-t border-dashed border-black my-2" />
      <div>13.06.2026 20:26</div>
      <div>## 2567</div>
      {s.show_items_table && (
        <>
          <div className="border-t border-dashed border-black my-2" />
          <div className="flex font-bold">
            <span className="flex-1">Наименование</span><span className="w-8 text-right">Кол.</span><span className="w-12 text-right">Сумма</span>
          </div>
          <Row name="Филадельфия" qty={1} sum={150} />
          <Row name="Калифорния" qty={2} sum={500} />
          <Row name="Coca-Cola" qty={1} sum={0} />
        </>
      )}
      {s.show_totals && (
        <>
          <div className="flex justify-between mt-1"><b>ИТОГО</b><span>650</span></div>
          <div className="flex justify-between"><span>Скидка</span><span>10%</span></div>
          <div className="flex justify-between font-extrabold"><span>К ОПЛАТЕ</span><span>585</span></div>
        </>
      )}
      {s.footer && (
        <div className="text-center mt-2 whitespace-pre-wrap">{s.footer}</div>
      )}
      {s.show_customer && (
        <>
          <div className="border-t border-dashed border-black my-2" />
          {s.show_bonus && <div><b>Баллы:</b> 75, за заказ: 0</div>}
          <div><b>Адрес:</b> проспект Мира, 120</div>
          <div><b>Телефон:</b> +7 (111) 111-11-11</div>
          <div><b>Примечание:</b> Привезти к 18:00</div>
        </>
      )}
    </div>
  );
}
function Row({ name, qty, sum }: { name: string; qty: number; sum: number }) {
  return (
    <div className="flex">
      <span className="flex-1">{name}</span>
      <span className="w-8 text-right">{qty}</span>
      <span className="w-12 text-right">{sum}</span>
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-xl border border-neutral-200 focus:border-primary outline-none";
function Field({ label, children }: any) {
  return <label className="block"><span className="text-sm text-neutral-600 block mb-1">{label}</span>{children}</label>;
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
