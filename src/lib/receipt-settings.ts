import { supabase } from "@/integrations/supabase/client";

export type ReceiptLanguage = "ru" | "en" | "kz";
export type ReceiptPaperWidth = 50 | 58 | 80;

export type ReceiptSettings = {
  logo_url: string;
  name: string;
  line1: string;
  line2: string;
  line3: string;
  footer: string;
  show_items_table: boolean;
  show_totals: boolean;
  show_customer: boolean;
  show_bonus: boolean;
  // new
  language: ReceiptLanguage;
  paper_width: ReceiptPaperWidth;
  font_size: number;
  show_comment: boolean;
  show_customer_name: boolean;
  show_employee_name: boolean;
  show_map: boolean;
  map_zoom: number;
};

export const DEFAULT_RECEIPT: ReceiptSettings = {
  logo_url: "",
  name: "КосмоСуши",
  line1: "",
  line2: "",
  line3: "",
  footer: "Приятного аппетита!",
  show_items_table: true,
  show_totals: true,
  show_customer: true,
  show_bonus: true,
  language: "ru",
  paper_width: 80,
  font_size: 13,
  show_comment: true,
  show_customer_name: true,
  show_employee_name: false,
  show_map: false,
  map_zoom: 15,
};

export function receiptKey(branchId?: string | null) {
  return branchId ? `kitchen_receipt:${branchId}` : "kitchen_receipt";
}

export async function loadReceiptSettings(branchId?: string | null): Promise<ReceiptSettings> {
  const keys = branchId ? [receiptKey(branchId), "kitchen_receipt"] : ["kitchen_receipt"];
  const { data } = await supabase.from("settings").select("key,value").in("key", keys);
  const rows = (data ?? []) as { key: string; value: any }[];
  const branchRow = branchId ? rows.find((r) => r.key === receiptKey(branchId)) : null;
  const globalRow = rows.find((r) => r.key === "kitchen_receipt");
  return {
    ...DEFAULT_RECEIPT,
    ...((globalRow?.value as Partial<ReceiptSettings>) ?? {}),
    ...((branchRow?.value as Partial<ReceiptSettings>) ?? {}),
  };
}

type Dict = Record<string, string>;
const DICTS: Record<ReceiptLanguage, Dict> = {
  ru: {
    name: "Наименование", qty: "Кол.", sum: "Сумма",
    total: "ИТОГО", discount: "Скидка", delivery: "Доставка",
    pay: "К ОПЛАТЕ", payment: "Оплата",
    type: "Тип", delivery_t: "ДОСТАВКА", pickup_t: "САМОВЫВОЗ",
    client: "Клиент", phone: "Телефон", address: "Адрес",
    time: "На время", persons: "Персон", bonus: "Баллы",
    bonus_used: "списано", bonus_earned: "начислено",
    comment: "Примечание", employee: "Сотрудник",
    end: "— конец заказа —", noItems: "Нет позиций",
    print: "🖨 Печать", close: "Закрыть",
  },
  en: {
    name: "Item", qty: "Qty", sum: "Sum",
    total: "TOTAL", discount: "Discount", delivery: "Delivery",
    pay: "TO PAY", payment: "Payment",
    type: "Type", delivery_t: "DELIVERY", pickup_t: "PICKUP",
    client: "Client", phone: "Phone", address: "Address",
    time: "Time", persons: "Persons", bonus: "Bonus",
    bonus_used: "used", bonus_earned: "earned",
    comment: "Note", employee: "Employee",
    end: "— end of order —", noItems: "No items",
    print: "🖨 Print", close: "Close",
  },
  kz: {
    name: "Атауы", qty: "Саны", sum: "Сома",
    total: "БАРЛЫҒЫ", discount: "Жеңілдік", delivery: "Жеткізу",
    pay: "ТӨЛЕУ", payment: "Төлем",
    type: "Түрі", delivery_t: "ЖЕТКІЗУ", pickup_t: "ӨЗІ АЛУ",
    client: "Клиент", phone: "Телефон", address: "Мекенжай",
    time: "Уақыт", persons: "Адам", bonus: "Бонус",
    bonus_used: "пайдаланылды", bonus_earned: "есептелді",
    comment: "Ескертпе", employee: "Қызметкер",
    end: "— тапсырыс соңы —", noItems: "Тауарлар жоқ",
    print: "🖨 Басып шығару", close: "Жабу",
  },
};

export function t(s: ReceiptSettings, key: string): string {
  return DICTS[s.language]?.[key] ?? DICTS.ru[key] ?? key;
}
