import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url?: string | null;
  weight?: string | null;
  quantity: number;
};

type CartCtx = {
  items: CartItem[];
  add: (p: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "kosmosushi_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const value = useMemo<CartCtx>(() => ({
    items,
    open,
    setOpen,
    add: (p, qty = 1) =>
      setItems((cur) => {
        const i = cur.findIndex((x) => x.id === p.id);
        if (i === -1) return [...cur, { ...p, quantity: qty }];
        const next = [...cur];
        next[i] = { ...next[i], quantity: next[i].quantity + qty };
        return next;
      }),
    remove: (id) => setItems((cur) => cur.filter((x) => x.id !== id)),
    setQty: (id, qty) =>
      setItems((cur) =>
        qty <= 0
          ? cur.filter((x) => x.id !== id)
          : cur.map((x) => (x.id === id ? { ...x, quantity: qty } : x)),
      ),
    clear: () => setItems([]),
    count: items.reduce((s, x) => s + x.quantity, 0),
    subtotal: items.reduce((s, x) => s + x.quantity * Number(x.price), 0),
  }), [items, open]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart must be used within CartProvider");
  return v;
}
