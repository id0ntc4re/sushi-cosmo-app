import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "kosmosushi_favorites_v1";
const HKEY = "kosmosushi_history_v1";

function readLocal(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function writeLocal(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("favorites:changed"));
}

export function useFavorites() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (user) {
      const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user.id);
      setIds(new Set((data ?? []).map((r: any) => r.product_id)));
    } else {
      setIds(new Set(readLocal()));
    }
  }, []);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("favorites:changed", h);
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => { window.removeEventListener("favorites:changed", h); sub.subscription.unsubscribe(); };
  }, [refresh]);

  const toggle = useCallback(async (productId: string): Promise<boolean> => {
    if (!userId) return false;
    const has = ids.has(productId);
    const next = new Set(ids);
    has ? next.delete(productId) : next.add(productId);
    setIds(next);
    if (has) await supabase.from("favorites").delete().eq("user_id", userId).eq("product_id", productId);
    else await supabase.from("favorites").insert({ user_id: userId, product_id: productId });
    return true;
  }, [ids, userId]);

  return { ids, toggle, has: (id: string) => ids.has(id), isAuthenticated: !!userId };
}

export function pushHistory(productId: string) {
  try {
    const arr: string[] = JSON.parse(localStorage.getItem(HKEY) || "[]");
    const next = [productId, ...arr.filter((x) => x !== productId)].slice(0, 20);
    localStorage.setItem(HKEY, JSON.stringify(next));
  } catch {}
}
export function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HKEY) || "[]"); } catch { return []; }
}
