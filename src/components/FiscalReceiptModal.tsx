import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { printFiscalReceipt, paymentLabel, type FiscalPaymentMethod } from "@/lib/fiscal-print";

type Props = {
  orderId: string;
  onClose: () => void;
  onPrinted?: () => void;
};

type OrderRow = {
  id: string;
  number: number;
  total: number;
  subtotal: number;
  discount: number;
  bonus_used: number;
  delivery_cost: number;
  payment_method: FiscalPaymentMethod;
  branch_id: string | null;
  customer_name: string | null;
  phone: string | null;
  fiscal_receipt_number: string | null;
  fiscal_printed_at: string | null;
};

type ItemRow = { id: string; name: string; price: number; quantity: number; total: number };

type Branch = {
  kkt_url: string | null;
  kkt_tax_system: string;
  kkt_vat: string;
  kkt_operator_name: string;
  kkt_operator_inn: string | null;
  name: string;
};

export function FiscalReceiptModal({ orderId, onClose, onPrinted }: Props) {
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<FiscalPaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<{ number: string; url?: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: o } = await supabase.from("orders")
        .select("id,number,total,subtotal,discount,bonus_used,delivery_cost,payment_method,branch_id,customer_name,phone,fiscal_receipt_number,fiscal_printed_at")
        .eq("id", orderId).maybeSingle();
      const { data: its } = await supabase.from("order_items")
        .select("id,name,price,quantity,total").eq("order_id", orderId);
      let b: Branch | null = null;
      if (o?.branch_id) {
        const { data } = await (supabase.from("branches") as any)
          .select("name,kkt_url,kkt_tax_system,kkt_vat,kkt_operator_name,kkt_operator_inn")
          .eq("id", o.branch_id).maybeSingle();
        b = data as Branch | null;
      }
      setOrder(o as OrderRow);
      setItems((its ?? []) as ItemRow[]);
      setBranch(b);
      if (o?.payment_method) setMethod(o.payment_method as FiscalPaymentMethod);
      setLoading(false);
    })();
  }, [orderId]);

  const totalCalc = useMemo(
    () => items.reduce((a, x) => a + Number(x.price) * Number(x.quantity), 0),
    [items]
  );

  async function punch() {
    if (!order || !branch) return;
    if (!branch.kkt_url) {
      toast.error("В настройках филиала не указан адрес драйвера ККТ");
      return;
    }
    setBusy(true);
    try {
      const res = await printFiscalReceipt({
        kktUrl: branch.kkt_url,
        taxationType: branch.kkt_tax_system || "usn_income",
        vat: branch.kkt_vat || "none",
        operatorName: branch.kkt_operator_name || "Кассир",
        operatorInn: branch.kkt_operator_inn,
        paymentMethod: method,
        total: Number(order.total),
        items: items.map((x) => ({ name: x.name, price: Number(x.price), quantity: Number(x.quantity) })),
        customerEmail: email || null,
        customerPhone: order.phone,
      });

      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      const fiscalNumber = res.fiscalReceiptNumber || res.fiscalDocumentNumber || "—";
      const { error } = await (supabase.from("orders") as any)
        .update({
          payment_status: "paid",
          payment_method: method,
          paid_at: new Date().toISOString(),
          fiscal_receipt_number: fiscalNumber,
          fiscal_receipt_url: res.ofdReceiptUrl ?? null,
          fiscal_printed_at: new Date().toISOString(),
          fiscal_payload: res.raw ?? null,
        })
        .eq("id", order.id);
      if (error) {
        toast.error("Чек пробит, но не удалось сохранить в заказ: " + error.message);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      await (supabase.from("order_changes") as any).insert({
        order_id: order.id, user_id: user?.id ?? null, action: "fiscal_printed",
        details: {
          payment_method: method,
          fiscal_receipt_number: fiscalNumber,
          fiscal_document_number: res.fiscalDocumentNumber,
          fiscal_sign: res.fiscalSign,
          fn_number: res.fnNumber,
        },
      });

      setDone({ number: fiscalNumber, url: res.ofdReceiptUrl });
      toast.success(`Фискальный чек пробит · №${fiscalNumber}`);
      onPrinted?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Ошибка пробивки");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Фискальный чек</div>
          <div className="text-xl font-extrabold">Заказ #{order?.number ?? "…"}</div>
        </div>

        {loading ? (
          <div className="text-center text-neutral-400 py-10 text-sm">Загрузка…</div>
        ) : !order ? (
          <div className="text-center text-red-500 py-10 text-sm">Заказ не найден</div>
        ) : done ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✅</div>
            <div className="font-bold text-lg mb-1">Чек пробит</div>
            <div className="text-sm text-neutral-600 mb-1">№ {done.number}</div>
            {done.url && (
              <a href={done.url} target="_blank" rel="noreferrer"
                className="inline-block mt-2 text-xs text-primary underline">Открыть чек в ОФД</a>
            )}
            <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl bg-neutral-900 text-white font-semibold text-sm">
              Закрыть
            </button>
          </div>
        ) : (
          <>
            {/* Предпросмотр чека — моноширинный */}
            <div className="bg-neutral-50 rounded-xl p-3 mb-4 font-mono text-[12px] leading-tight">
              <div className="text-center font-bold mb-1">{branch?.name ?? ""}</div>
              <div className="text-center text-[10px] text-neutral-500 mb-2">КАССОВЫЙ ЧЕК · ПРОДАЖА</div>
              <div className="border-t border-dashed border-neutral-300 my-1" />
              {items.map((it) => (
                <div key={it.id} className="mb-1">
                  <div className="truncate">{it.name}</div>
                  <div className="flex justify-between text-[11px]">
                    <span>{Number(it.quantity)} × {Number(it.price).toFixed(2)}</span>
                    <span className="font-bold">{Number(it.total).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-dashed border-neutral-300 my-1" />
              <Row k="Подытог" v={`${Number(order.subtotal).toFixed(2)} ₽`} />
              {Number(order.discount) > 0 && <Row k="Скидка" v={`−${Number(order.discount).toFixed(2)} ₽`} />}
              {Number(order.bonus_used) > 0 && <Row k="Бонусы" v={`−${Number(order.bonus_used).toFixed(2)} ₽`} />}
              {Number(order.delivery_cost) > 0 && <Row k="Доставка" v={`${Number(order.delivery_cost).toFixed(2)} ₽`} />}
              <div className="flex justify-between font-extrabold text-sm mt-1 pt-1 border-t">
                <span>ИТОГО</span>
                <span>{Number(order.total).toFixed(2)} ₽</span>
              </div>
              <div className="text-[10px] text-neutral-500 mt-1">
                {totalCalc !== Number(order.total) && (
                  <div className="text-amber-700">⚠ Сумма позиций ({totalCalc.toFixed(2)}) отличается от итога — будет применена скидка строкой</div>
                )}
              </div>
            </div>

            {/* Способ оплаты */}
            <div className="mb-3">
              <div className="text-xs font-bold text-neutral-600 mb-1.5">Способ оплаты</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["cash","card_courier","card_online"] as FiscalPaymentMethod[]).map((m) => (
                  <button key={m} onClick={() => setMethod(m)}
                    className={`py-2 rounded-lg text-xs font-bold border-2 ${
                      method === m ? "border-primary bg-primary/10 text-primary" : "border-neutral-200"
                    }`}>
                    {m === "cash" ? "💵 Наличные" : m === "card_courier" ? "💳 Картой" : "🌐 Онлайн"}
                  </button>
                ))}
              </div>
            </div>

            {/* Email для электронного чека */}
            <div className="mb-4">
              <label className="text-xs font-bold text-neutral-600 block mb-1">
                Email для электронного чека (необязательно)
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="client@email.ru"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
              />
            </div>

            {!branch?.kkt_url && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-2.5 mb-3">
                ⚠ В настройках филиала не указан URL драйвера ККТ. Откройте «Филиалы» → редактирование, поле «Адрес драйвера ККТ».
              </div>
            )}

            {order.fiscal_printed_at && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg p-2.5 mb-3">
                ℹ Этот заказ уже фискализирован {new Date(order.fiscal_printed_at).toLocaleString("ru")} · чек {order.fiscal_receipt_number}
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                onClick={punch}
                disabled={busy || !branch?.kkt_url}
                className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold disabled:opacity-50">
                {busy ? "Пробиваем…" : `🧾 Пробить чек · ${paymentLabel(method)}`}
              </button>
              <button onClick={onClose} disabled={busy}
                className="px-4 py-3 rounded-xl bg-neutral-100 font-semibold text-sm">
                Отмена
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span>{k}</span><span>{v}</span></div>;
}
