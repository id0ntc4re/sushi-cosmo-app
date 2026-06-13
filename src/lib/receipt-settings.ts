import { supabase } from "@/integrations/supabase/client";

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
