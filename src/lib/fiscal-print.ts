// Печать фискального чека через драйвер Атол ККТ v10 (DTO 10.x)
// Локальный HTTP-сервер драйвера: по умолчанию http://localhost:16732
// Документация: POST /requests/ создаёт задачу, GET /requests/<uuid> отдаёт результат.
// Демо-режим: kktUrl = "demo://atol" эмулирует успешный ответ без реального запроса.

function isDemoKkt(kktUrl: string): boolean {
  return (kktUrl || "").trim().toLowerCase().startsWith("demo://");
}

function makeDemoResult(taskUuid: string, input: FiscalPrintInput): FiscalPrintResult {
  const now = new Date().toISOString();
  const demoFn = "9999078900001234";
  const demoDocNum = String(Math.floor(100000 + Math.random() * 899999));
  return {
    ok: true,
    uuid: taskUuid,
    fiscalReceiptNumber: demoDocNum,
    fiscalDocumentNumber: demoDocNum,
    fiscalSign: String(Math.floor(1000000000 + Math.random() * 8999999999)),
    fnNumber: demoFn,
    shiftNumber: 1,
    receiptDatetime: now,
    ofdReceiptUrl: `https://check.ofd.ru/?fn=${demoFn}&fd=${demoDocNum}`,
    raw: {
      status: "ready",
      uuid: taskUuid,
      results: [{
        status: "ready",
        fiscalDocumentNumber: Number(demoDocNum),
        fiscalReceiptNumber: Number(demoDocNum),
        fiscalSign: Math.floor(1000000000 + Math.random() * 8999999999),
        fnNumber: demoFn,
        shiftNumber: 1,
        receiptDatetime: now,
        ofdReceiptUrl: `https://check.ofd.ru/?fn=${demoFn}&fd=${demoDocNum}`,
      }],
    },
  };
}

export type FiscalPaymentMethod = "cash" | "card_courier" | "card_online";

export type FiscalItem = {
  name: string;
  price: number;
  quantity: number;
};

export type FiscalPrintInput = {
  kktUrl: string;             // http://localhost:16732
  taxationType: string;       // usn_income | usn_income_outcome | osn | envd | esn | patent
  vat: string;                // none | vat0 | vat10 | vat20 | vat110 | vat120
  operatorName: string;
  operatorInn?: string | null;
  paymentMethod: FiscalPaymentMethod;
  total: number;
  items: FiscalItem[];
  customerEmail?: string | null;
  customerPhone?: string | null;
  paymentsPlace?: string | null;
  paymentsAddress?: string | null;
  receiptType?: "sell" | "sellRefund"; // по умолчанию sell
};

export type FiscalPrintResult = {
  ok: true;
  uuid: string;
  fiscalReceiptNumber?: string;
  fiscalDocumentNumber?: string;
  fiscalSign?: string;
  fnNumber?: string;
  shiftNumber?: number;
  receiptDatetime?: string;
  ofdReceiptUrl?: string;
  raw: any;
};

export type FiscalPrintError = {
  ok: false;
  message: string;
  raw?: any;
};

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function r2(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

function buildTask(input: FiscalPrintInput, taskUuid: string) {
  const payType =
    input.paymentMethod === "cash" ? "cash" : "electronically"; // card_courier и card_online — безнал

  // Распределяем скидку (subtotal - total) пропорционально по позициям,
  // чтобы касса показала «Скидка X.XX» под каждой строкой как на чеке АТОЛ.
  const grossSubtotal = input.items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0);
  const targetTotal = r2(input.total);
  const totalDiscount = Math.max(0, r2(grossSubtotal) - targetTotal);

  let distributed = 0;
  const items = input.items.map((it, idx) => {
    const gross = r2(Number(it.price) * Number(it.quantity));
    let discAmount = 0;
    if (totalDiscount > 0 && grossSubtotal > 0) {
      if (idx === input.items.length - 1) {
        discAmount = r2(totalDiscount - distributed); // последний — добивка, чтобы сошлось до копейки
      } else {
        discAmount = r2((gross / grossSubtotal) * totalDiscount);
        distributed = r2(distributed + discAmount);
      }
    }
    const lineAmount = r2(gross - discAmount);
    const qty = Number(it.quantity);
    const finalPrice = qty > 0 ? r2(lineAmount / qty) : r2(it.price);
    return {
      type: "position",
      name: it.name.slice(0, 128),
      price: finalPrice,
      quantity: qty,
      amount: lineAmount,
      measurementUnit: "шт",
      paymentMethod: "fullPayment",
      paymentObject: "commodity",
      tax: { type: input.vat || "none" },
    };
  });

  const electronically =
    input.customerEmail
      ? { email: input.customerEmail }
      : input.customerPhone
        ? { phone: input.customerPhone.replace(/\D/g, "") }
        : null;

  const request: any = {
    type: input.receiptType === "sellRefund" ? "sellRefund" : "sell",
    taxationType: input.taxationType || "usn_income",
    operator: { name: input.operatorName, ...(input.operatorInn ? { vatin: input.operatorInn } : {}) },
    items,
    payments: [{ type: payType, sum: r2(input.total) }],
    total: r2(input.total),
  };
  if (input.paymentsPlace) request.paymentsPlace = input.paymentsPlace;
  if (input.paymentsAddress) request.paymentsAddress = input.paymentsAddress;
  if (electronically) request.clientInfo = electronically;

  return { uuid: taskUuid, request: [request] };
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
    return { res, data, text };
  } finally {
    clearTimeout(t);
  }
}

export async function printFiscalReceipt(input: FiscalPrintInput, _retry = false): Promise<FiscalPrintResult | FiscalPrintError> {
  const base = (input.kktUrl || "").trim().replace(/\/$/, "");
  if (!base) return { ok: false, message: "Не задан адрес драйвера ККТ для филиала" };

  const taskUuid = uuid();

  // Демо-режим: эмулируем ответ без реального запроса к кассе
  if (isDemoKkt(base)) {
    // Имитируем небольшую задержку «печати»
    await new Promise((r) => setTimeout(r, 600));
    return makeDemoResult(taskUuid, input);
  }

  const body = buildTask(input, taskUuid);

  // 1) Отправляем задачу
  let postRes;
  try {
    postRes = await fetchJson(`${base}/requests/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("aborted")) {
      return {
        ok: false,
        message: `Касса недоступна по адресу ${base}. Проверьте, что драйвер ККТ v10 запущен на ПК кассира и порт открыт.`,
      };
    }
    return { ok: false, message: msg };
  }

  if (!postRes.res.ok) {
    return { ok: false, message: `Драйвер вернул ошибку ${postRes.res.status}: ${postRes.text || ""}`, raw: postRes.data };
  }

  // 2) Опрашиваем результат до 25 секунд (печать чека на термопринтере)
  const deadline = Date.now() + 25000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() > deadline) {
      return { ok: false, message: "Касса не вернула результат за 25 секунд. Проверьте бумагу/связь." };
    }
    await new Promise((r) => setTimeout(r, 800));

    let getRes;
    try {
      getRes = await fetchJson(`${base}/requests/${taskUuid}`);
    } catch {
      continue;
    }
    if (!getRes.res.ok || !getRes.data) continue;

    const status = getRes.data.status;
    if (status === "ready") {
      const r0 = (getRes.data.results && getRes.data.results[0]) || {};
      const err = r0.error || getRes.data.error;
      if (err) {
        const errMsg = typeof err === "string" ? err : (err.description || err.message || JSON.stringify(err));
        if (!_retry && /смен[аы].*(закры|не\s*открыт)|need.*open.*shift|shift.*closed|необходимо открыть смену/i.test(errMsg)) {
          // Авто-открытие смены и повторная попытка пробить чек
          const open = await runShiftCommand(input.kktUrl, input.operatorName, input.operatorInn, "openShift");
          if (open.ok) return printFiscalReceipt(input, true);
        }
        return { ok: false, message: `Касса вернула ошибку: ${errMsg}`, raw: getRes.data };
      }
      return {
        ok: true,
        uuid: taskUuid,
        fiscalReceiptNumber: String(r0.fiscalReceiptNumber ?? r0.fiscalDocumentNumber ?? ""),
        fiscalDocumentNumber: r0.fiscalDocumentNumber ? String(r0.fiscalDocumentNumber) : undefined,
        fiscalSign: r0.fiscalSign ? String(r0.fiscalSign) : undefined,
        fnNumber: r0.fnNumber ? String(r0.fnNumber) : undefined,
        shiftNumber: r0.shiftNumber,
        receiptDatetime: r0.receiptDatetime,
        ofdReceiptUrl: r0.ofdReceiptUrl,
        raw: getRes.data,
      };
    }
    if (status === "error") {
      const err = getRes.data.error;
      const errMsg = typeof err === "string" ? err : (err?.description || err?.message || "неизвестная ошибка");
      if (!_retry && /смен[аы].*(закры|не\s*открыт)|need.*open.*shift|shift.*closed|необходимо открыть смену/i.test(errMsg)) {
        const open = await runShiftCommand(input.kktUrl, input.operatorName, input.operatorInn, "openShift");
        if (open.ok) return printFiscalReceipt(input, true);
      }
      return { ok: false, message: `Касса вернула ошибку: ${errMsg}`, raw: getRes.data };
    }
    // status === "wait" | "inProgress" — продолжаем опрос
  }
}

export function refundFiscalReceipt(input: FiscalPrintInput) {
  return printFiscalReceipt({ ...input, receiptType: "sellRefund" });
}

export function paymentLabel(m: FiscalPaymentMethod): string {
  return m === "cash" ? "Наличные" : m === "card_courier" ? "Карта" : "Онлайн";
}

export type ShiftCommand = "openShift" | "closeShift";

export async function runShiftCommand(
  kktUrl: string,
  operatorName: string,
  operatorInn: string | null | undefined,
  cmd: ShiftCommand,
): Promise<FiscalPrintResult | FiscalPrintError> {
  const base = (kktUrl || "").trim().replace(/\/$/, "");
  if (!base) return { ok: false, message: "Не задан адрес драйвера ККТ для филиала" };

  const taskUuid = uuid();
  const body = {
    uuid: taskUuid,
    request: [{
      type: cmd,
      operator: { name: operatorName || "Кассир", ...(operatorInn ? { vatin: operatorInn } : {}) },
    }],
  };

  let postRes;
  try {
    postRes = await fetchJson(`${base}/requests/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("aborted")) {
      return { ok: false, message: `Касса недоступна по адресу ${base}. Проверьте, что драйвер ККТ запущен.` };
    }
    return { ok: false, message: msg };
  }
  if (!postRes.res.ok) {
    return { ok: false, message: `Драйвер вернул ошибку ${postRes.res.status}: ${postRes.text || ""}`, raw: postRes.data };
  }

  const deadline = Date.now() + 25000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() > deadline) return { ok: false, message: "Касса не вернула результат за 25 секунд." };
    await new Promise((r) => setTimeout(r, 800));
    let getRes;
    try { getRes = await fetchJson(`${base}/requests/${taskUuid}`); } catch { continue; }
    if (!getRes.res.ok || !getRes.data) continue;
    const status = getRes.data.status;
    if (status === "ready") {
      const r0 = (getRes.data.results && getRes.data.results[0]) || {};
      const err = r0.error || getRes.data.error;
      if (err) {
        const errMsg = typeof err === "string" ? err : (err.description || err.message || JSON.stringify(err));
        return { ok: false, message: `Касса вернула ошибку: ${errMsg}`, raw: getRes.data };
      }
      return { ok: true, uuid: taskUuid, shiftNumber: r0.shiftNumber, raw: getRes.data };
    }
    if (status === "error") {
      const err = getRes.data.error;
      const errMsg = typeof err === "string" ? err : (err?.description || err?.message || "неизвестная ошибка");
      return { ok: false, message: `Касса вернула ошибку: ${errMsg}`, raw: getRes.data };
    }
  }
}
