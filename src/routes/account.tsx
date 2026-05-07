import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Личный кабинет — КосмоСуши" }] }),
  component: Account,
});

type Order = {
  id: string;
  number: number;
  status: string;
  total: number;
  created_at: string;
  delivery_type: string;
  address: string | null;
  pickup_point: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
};

const STATUS_LABEL: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  cooking: "Готовится",
  delivering: "В пути",
  done: "Выполнен",
  cancelled: "Отменён",
};

function Account() {
  const nav = useNavigate();
  const cart = useCart();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        nav({ to: "/login", search: { redirect: "/account" } });
        return;
      }
      setEmail(user.email ?? null);

      const { data: ord } = await supabase
        .from("orders")
        .select("id,number,status,total,created_at,delivery_type,address,pickup_point")
        .order("created_at", { ascending: false });
      setOrders((ord as Order[]) ?? []);

      if (ord && ord.length) {
        const ids = ord.map((o: any) => o.id);
        const { data: its } = await supabase
          .from("order_items")
          .select("id,order_id,product_id,name,price,quantity")
          .in("order_id", ids);
        const grouped: Record<string, OrderItem[]> = {};
        (its as OrderItem[] | null)?.forEach((it) => {
          (grouped[it.order_id] ||= []).push(it);
        });
        setItems(grouped);
      }
      setLoading(false);
    })();
  }, [nav]);

  async function repeat(orderId: string) {
    const list = items[orderId] ?? [];
    if (!list.length) return;
    const ids = list.map((x) => x.product_id).filter(Boolean) as string[];
    const { data: prods } = await supabase
      .from("products")
      .select("id,name,price,image_url,weight,is_active,in_stock")
      .in("id", ids);
    const byId = new Map((prods ?? []).map((p: any) => [p.id, p]));
    let added = 0, skipped = 0;
    for (const it of list) {
      const p = it.product_id ? byId.get(it.product_id) : null;
      if (p && p.is_active && p.in_stock) {
        cart.add(
          { id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url, weight: p.weight },
          it.quantity,
        );
        added++;
      } else skipped++;
    }
    if (added) toast.success(`Добавлено в корзину: ${added}`, skipped ? { description: `Недоступно: ${skipped}` } : undefined);
    else toast.error("Товары больше не доступны");
    cart.setOpen(true);
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b">
        <div className="mx-auto max-w-[1280px] px-6 h-20 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-10 w-10" />
            <span className="font-extrabold text-xl">КосмоСуши</span>
          </Link>
          <Link to="/" className="ml-auto text-sm text-neutral-600 hover:text-primary">← В меню</Link>
          <button
            onClick={async () => { await supabase.auth.signOut(); nav({ to: "/" }); }}
            className="text-sm text-neutral-600 hover:text-primary"
          >Выйти</button>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold">Личный кабинет</h1>
          <p className="text-neutral-500 mt-1">{email}</p>
        </div>

        <h2 className="text-xl font-extrabold mb-4">История заказов</h2>

        {loading && <div className="py-12 text-center text-neutral-500">Загружаем…</div>}

        {!loading && orders.length === 0 && (
          <div className="bg-white rounded-3xl p-10 text-center">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-neutral-500 mb-4">У вас ещё нет заказов</p>
            <Link to="/" className="inline-block px-6 py-3 rounded-full bg-primary text-white font-bold">К меню</Link>
          </div>
        )}

        <div className="space-y-3">
          {orders.map((o) => {
            const isOpen = open === o.id;
            return (
              <div key={o.id} className="bg-white rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : o.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-neutral-50"
                >
                  <div className="flex-1">
                    <div className="font-bold">Заказ №{o.number}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {new Date(o.created_at).toLocaleString("ru")} · {o.delivery_type === "delivery" ? "Доставка" : "Самовывоз"}
                    </div>
                  </div>
                  <span className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  <div className="font-extrabold text-lg whitespace-nowrap">{Number(o.total)} ₽</div>
                  <span className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                {isOpen && (
                  <div className="border-t p-5 bg-neutral-50/50">
                    <div className="space-y-2 mb-4">
                      {(items[o.id] ?? []).map((it) => (
                        <div key={it.id} className="flex justify-between text-sm">
                          <div className="flex-1">
                            <div className="font-medium">{it.name}</div>
                            <div className="text-xs text-neutral-500">{it.quantity} × {Number(it.price)} ₽</div>
                          </div>
                          <div className="font-semibold">{it.quantity * Number(it.price)} ₽</div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => repeat(o.id)}
                      className="px-5 py-2.5 rounded-full bg-primary text-white font-bold hover:opacity-90"
                    >
                      🔁 Повторить заказ
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
