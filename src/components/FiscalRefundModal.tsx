import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { refundFiscalReceipt, paymentLabel, type FiscalPaymentMethod } from "@/lib/fiscal-print";

type Props = {
  orderId: string;
  onClose: () => void;
  onRefunded?: () => void;
};

type SellReceipt = {
  id: string;
  fiscal_receipt_number: string | null;
  fiscal_document_number: string | null;
  receipt_datetime: string | null;
  total: number;
  payment_method: FiscalPaymentMethod;
  items: Array<{ name: string; price: number; quantity: number }> | null;
};

type Branch = {
  name: string;
  kkt_url: string | null;
  kkt_tax_system: string;
  kkt_vat: string;
  kkt_operator_name: string;
  kkt_operator_inn: string | null;
  kkt_payments_place: string | null;
  kkt_payments_address: string | null;
  is_demo: boolean | null;
};

type Line = {
  key: string;
  name: string;
  price: number;
  sold: number;       // изначально продано в этом чеке
  alreadyRefunded: number;
  qty: number;        // выбранное к возврату
};

function r2(n: number) { return Math.round(Number(n) * 100) / 100; }

export function FiscalRefundModal({ orderId, onClose, onRefunded }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [sells, setSells] = useState<SellReceipt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<FiscalPaymentMethod>("cash");
  const [done, setDone] = useState<{ number: string; url?: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: o } = await supabase.from("orders")
        .select("id,number,phone,branch_id,payment_method,total").eq("id", orderId).maybeSingle();
      setOrder(o);
      if ((o as any)?.payment_method) setMethod((o as any).payment_method);
      if ((o as any)?.branch_id) {
        // ККТ-настройки филиала — только через SECURITY DEFINER RPC
        const { data } = await (supabase.rpc as any)("get_branch_full", { _id: (o as any).branch_id });
        const row = Array.isArray(data) ? data[0] : data;
        setBranch((row ?? null) as Branch | null);
      }

      // Загружаем все фискальные чеки по заказу
      const { data: receipts } = await (supabase.from("fiscal_receipts") as any)
        .select("id,receipt_type,parent_receipt_id,fiscal_receipt_number,fiscal_document_number,receipt_datetime,total,payment_method,items,raw_response")
        .eq("order_id", orderId).order("created_at", { ascending: true });
      const all = (receipts ?? []) as any[];
      const sellRows: SellReceipt[] = all
        .filter((r) => r.receipt_type !== "sell_refund")
        .map((r) => ({
          id: r.id,
          fiscal_receipt_number: r.fiscal_receipt_number,
          fiscal_document_number: r.fiscal_document_number,
          receipt_datetime: r.receipt_datetime,
          total: Number(r.total ?? 0),
          payment_method: r.payment_method,
          items: (r.items as any) ?? extractItemsFromRaw(r.raw_response),
        }));
      setSells(sellRows);
      if (sellRows.length > 0) {
        const first = sellRows[sellRows.length - 1]; // последний — обычно последняя продажа
        setSelectedId(first.id);
        setMethod(first.payment_method); // способ возврата = способ исходной продажи (требование 54-ФЗ)
        buildLines(first, all);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function extractItemsFromRaw(raw: any): { name: string; price: number; quantity: number }[] {
    // Фолбэк: если в новой колонке items пусто (старые записи) — берём из payload, который слали в кассу
    const req = raw?.request?.[0] ?? raw?.results?.[0]?.request;
    const items = (req?.items ?? []) as any[];
    return items.map((it) => ({ name: it.name, price: Number(it.price), quantity: Number(it.quantity) }));
  }

  async function buildLines(sell: SellReceipt, all: any[]) {
    // Считаем сколько по каждой позиции уже возвращено по этому исходному чеку
    const refundsForThis = all.filter((r) => r.receipt_type === "sell_refund" && r.parent_receipt_id === sell.id);
    const refundedMap = new Map<string, number>();
    for (const ref of refundsForThis) {
      const items = (ref.items as any[]) ?? [];
      for (const it of items) {
        const key = `${it.name}__${Number(it.price)}`;
        refundedMap.set(key, (refundedMap.get(key) ?? 0) + Number(it.quantity));
      }
    }
    const base = (sell.items ?? []).map((it, idx) => {
      const key = `${it.name}__${Number(it.price)}`;
      const already = refundedMap.get(key) ?? 0;
      return {
        key: `${idx}_${key}`,
        name: it.name,
        price: Number(it.price),
        sold: Number(it.quantity),
        alreadyRefunded: already,
        qty: 0,
      } as Line;
    });
    setLines(base);
  }

  function onSelectReceipt(id: string) {
    setSelectedId(id);
    const sell = sells.find((s) => s.id === id);
    if (!sell) return;
    setMethod(sell.payment_method);
    // загрузим все, чтобы пересчитать остатки (повторно дёргаем БД)
    (async () => {
      const { data: receipts } = await (supabase.from("fiscal_receipts") as any)
        .select("id,receipt_type,parent_receipt_id,items,raw_response")
        .eq("order_id", orderId);
      buildLines(sell, (receipts ?? []) as any[]);
    })();
  }

  function refundAll() {
    setLines((ls) => ls.map((l) => ({ ...l, qty: Math.max(0, l.sold - l.alreadyRefunded) })));
  }
  function clearAll() {
    setLines((ls) => ls.map((l) => ({ ...l, qty: 0 })));
  }
  function setQty(key: string, v: number) {
    setLines((ls) => ls.map((l) => {
      if (l.key !== key) return l;
      const max = l.sold - l.alreadyRefunded;
      const q = Math.max(0, Math.min(max, Math.floor(v)));
      return { ...l, qty: q };
    }));
  }

  const total = useMemo(
    () => r2(lines.reduce((s, l) => s + l.qty * l.price, 0)),
    [lines]
  );
  const someSelected = lines.some((l) => l.qty > 0);
  const sell = sells.find((s) => s.id === selectedId) || null;

  async function punchRefund() {
    if (!order || !branch || !sell) return;
    if (!branch.kkt_url) { toast.error("В настройках филиала не указан адрес драйвера ККТ"); return; }
    if (!someSelected) { toast.error("Выберите позиции для возврата"); return; }
    setBusy(true);
    try {
      const refundItems = lines.filter((l) => l.qty > 0).map((l) => ({
        name: l.name, price: l.price, quantity: l.qty,
      }));

      const res = await refundFiscalReceipt({
        kktUrl: branch.kkt_url,
        taxationType: branch.kkt_tax_system || "usn_income",
        vat: branch.kkt_vat || "none",
        operatorName: branch.kkt_operator_name || "Кассир",
        operatorInn: branch.kkt_operator_inn,
        paymentMethod: method,
        total,
        items: refundItems,
        customerEmail: null,
        customerPhone: order.phone,
        paymentsPlace: branch.kkt_payments_place,
        paymentsAddress: branch.kkt_payments_address,
      });

      if (!res.ok) { toast.error(res.message); return; }

      const fiscalNumber = res.fiscalReceiptNumber || res.fiscalDocumentNumber || "—";
      const { data: { user } } = await supabase.auth.getUser();

      // Найдём активную смену (без авто-создания — возврат вне смены крайне маловероятен)
      let shiftId: string | null = null;
      if (order.branch_id) {
        const { data: sh } = await supabase.from("cash_shifts")
          .select("id").eq("branch_id", order.branch_id).is("closed_at", null)
          .order("opened_at", { ascending: false }).limit(1).maybeSingle();
        shiftId = sh?.id ?? null;
      }

      const { error: insErr } = await (supabase.from("fiscal_receipts") as any).insert({
        order_id: order.id,
        branch_id: order.branch_id,
        shift_id: shiftId,
        receipt_type: "sell_refund",
        parent_receipt_id: sell.id,
        fiscal_document_number: res.fiscalDocumentNumber ?? null,
        fiscal_sign: res.fiscalSign ?? null,
        fiscal_receipt_number: res.fiscalReceiptNumber ?? null,
        fn_number: res.fnNumber ?? null,
        shift_number: res.shiftNumber ?? null,
        receipt_datetime: res.receiptDatetime ?? null,
        ofd_receipt_url: res.ofdReceiptUrl ?? null,
        payment_method: method,
        total,
        items: refundItems,
        vat: branch.kkt_vat || "none",
        taxation_type: branch.kkt_tax_system || "usn_income",
        operator_name: branch.kkt_operator_name || "Кассир",
        operator_inn: branch.kkt_operator_inn ?? null,
        raw_response: res.raw ?? null,
      });
      if (insErr) {
        // Касса возврат уже пробила, но в БД не записалось — критично, нужно ручное вмешательство
        toast.error(`ВНИМАНИЕ! Чек пробит на кассе (№${fiscalNumber}), но не записан в БД: ${insErr.message}. Сохраните номер чека и обратитесь к администратору.`, { duration: 30000 });
        return;
      }

      await (supabase.from("order_changes") as any).insert({
        order_id: order.id, user_id: user?.id ?? null, action: "fiscal_refunded",
        details: {
          payment_method: method,
          total,
          items: refundItems,
          fiscal_receipt_number: fiscalNumber,
          fiscal_document_number: res.fiscalDocumentNumber,
          parent_receipt_id: sell.id,
        },
      });

      setDone({ number: fiscalNumber, url: res.ofdReceiptUrl });
      toast.success(`Чек возврата пробит · №${fiscalNumber}`);
      onRefunded?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Ошибка возврата");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400 flex items-center justify-center gap-1.5">
            Возврат прихода
            {branch?.is_demo && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-extrabold leading-none">
                ДЕМО
              </span>
            )}
          </div>
          <div className="text-xl font-extrabold">Заказ #{order?.number ?? "…"}</div>
        </div>

        {loading ? (
          <div className="text-center text-neutral-400 py-10 text-sm">Загрузка…</div>
        ) : sells.length === 0 ? (
          <div className="text-center text-red-500 py-10 text-sm">По этому заказу нет фискальных чеков продажи — возвращать нечего.</div>
        ) : done ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">↩️</div>
            <div className="font-bold text-lg mb-1">Возврат пробит</div>
            <div className="text-sm text-neutral-600 mb-1">№ {done.number}</div>
            {done.url && (
              <a href={done.url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-primary underline">
                Открыть чек в ОФД
              </a>
            )}
            <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl bg-neutral-900 text-white font-semibold text-sm">
              Закрыть
            </button>
          </div>
        ) : (
          <>
            {sells.length > 1 && (
              <div className="mb-3">
                <div className="text-xs font-bold text-neutral-600 mb-1.5">Исходный чек продажи</div>
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => onSelectReceipt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm">
                  {sells.map((s) => (
                    <option key={s.id} value={s.id}>
                      №{s.fiscal_receipt_number ?? s.fiscal_document_number ?? "—"} · {s.total.toFixed(2)} ₽
                      {s.receipt_datetime ? ` · ${new Date(s.receipt_datetime).toLocaleString("ru")}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-neutral-50 rounded-xl p-3 mb-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold text-neutral-600">Позиции к возврату</div>
                <div className="flex gap-1.5">
                  <button onClick={refundAll} className="text-[11px] font-semibold px-2 py-1 rounded-md bg-white border">Всё</button>
                  <button onClick={clearAll} className="text-[11px] font-semibold px-2 py-1 rounded-md bg-white border">Снять</button>
                </div>
              </div>
              <div className="space-y-2">
                {lines.map((l) => {
                  const max = l.sold - l.alreadyRefunded;
                  const disabled = max <= 0;
                  return (
                    <div key={l.key} className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{l.name}</div>
                        <div className="text-[11px] text-neutral-500">
                          {l.price.toFixed(2)} ₽ · продано {l.sold}
                          {l.alreadyRefunded > 0 && <span className="text-amber-700"> · уже возвращено {l.alreadyRefunded}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button disabled={disabled} onClick={() => setQty(l.key, l.qty - 1)}
                          className="h-7 w-7 rounded-full bg-white border font-bold disabled:opacity-30">−</button>
                        <input
                          type="number" min={0} max={max} value={l.qty}
                          onChange={(e) => setQty(l.key, Number(e.target.value))}
                          disabled={disabled}
                          className="w-12 text-center text-sm font-bold border rounded-md py-1" />
                        <button disabled={disabled} onClick={() => setQty(l.key, l.qty + 1)}
                          className="h-7 w-7 rounded-full bg-primary text-white font-bold disabled:opacity-30">+</button>
                      </div>
                      <div className="w-20 text-right text-sm font-semibold">{r2(l.qty * l.price).toFixed(2)} ₽</div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t mt-3 pt-2 flex justify-between font-extrabold">
                <span>К возврату</span>
                <span>{total.toFixed(2)} ₽</span>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold text-neutral-600 mb-1.5">Способ возврата</div>
              <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-2.5">
                <span className="text-sm font-bold">
                  {method === "cash" ? "💵 Наличные" : method === "card_courier" ? "💳 Картой" : "🌐 Онлайн"}
                </span>
                <span className="text-[11px] text-neutral-500">— как в исходном чеке (требование 54-ФЗ)</span>
              </div>
            </div>

            {!branch?.kkt_url && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-2.5 mb-3">
                ⚠ В настройках филиала не указан URL драйвера ККТ.
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                onClick={punchRefund}
                disabled={busy || !branch?.kkt_url || !someSelected}
                className="py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold disabled:opacity-50">
                {busy ? "Пробиваем…" : `↩ Пробить возврат · ${paymentLabel(method)}`}
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
