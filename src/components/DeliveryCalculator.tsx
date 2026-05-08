import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  weight: string | null;
  category_id: string | null;
};
type Category = { id: string; name: string };

type Props = {
  subtotal: number;
  onOpenCart: () => void;
};

export function DeliveryCalculator({ subtotal, onOpenCart }: Props) {
  const [freeFrom, setFreeFrom] = useState(1500);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "general")
      .maybeSingle()
      .then(({ data }) => {
        const v: any = data?.value;
        if (v?.free_delivery_from || v?.free_from)
          setFreeFrom(Number(v.free_delivery_from ?? v.free_from));
      });

    (async () => {
      const [cats, prods] = await Promise.all([
        supabase.from("categories").select("id,name").eq("is_active", true).order("sort_order"),
        supabase
          .from("products")
          .select("id,name,price,image_url,weight,category_id")
          .eq("is_active", true)
          .eq("in_stock", true)
          .eq("is_addon", false)
          .order("sort_order")
          .limit(60),
      ]);
      setCategories((cats.data as Category[]) ?? []);
      setProducts((prods.data as Product[]) ?? []);
      if (cats.data?.[0]) setActiveCat(cats.data[0].id);
    })();
  }, []);

  const draft = useMemo(
    () =>
      Object.entries(picks).reduce((s, [id, qty]) => {
        const p = products.find((x) => x.id === id);
        return s + (p ? Number(p.price) * qty : 0);
      }, 0),
    [picks, products],
  );

  const total = subtotal + draft;
  const left = Math.max(0, freeFrom - total);
  const pct = Math.min(100, (total / freeFrom) * 100);
  const free = left === 0;

  const visible = useMemo(
    () => products.filter((p) => (activeCat ? p.category_id === activeCat : true)).slice(0, 12),
    [products, activeCat],
  );

  const inc = (id: string) => setPicks((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
  const dec = (id: string) =>
    setPicks((p) => {
      const n = (p[id] ?? 0) - 1;
      const next = { ...p };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });

  return (
    <section className="mx-auto max-w-[1280px] px-6 mt-10">
      <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider">
            🚚 Калькулятор доставки
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold leading-tight bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            {free ? "Ура! Доставка бесплатная 🎉" : `До бесплатной доставки осталось ${left} ₽`}
          </h2>
          <p className="mt-2 text-muted-foreground text-sm md:text-base">
            Соберите примерный заказ — мы посчитаем сумму и подскажем, сколько добавить до бесплатной
            доставки (от <span className="font-bold text-foreground">{freeFrom} ₽</span>).
          </p>

          <div className="mt-5">
            <div className="flex justify-between text-xs font-semibold mb-2">
              <span className="text-muted-foreground">
                В корзине: <span className="text-foreground font-bold">{Math.round(subtotal)} ₽</span>
                {draft > 0 && <span className="text-primary"> +{Math.round(draft)} ₽</span>}
              </span>
              <span className="text-primary">{freeFrom} ₽</span>
            </div>
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-6">
            <div>
              {/* category tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      activeCat === c.id
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "bg-card border-2 border-dashed border-primary/30 hover:border-primary"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* product grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {visible.map((p) => {
                  const qty = picks[p.id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl bg-card border-2 border-dashed transition-all overflow-hidden ${
                        qty > 0 ? "border-primary shadow-md shadow-primary/20" : "border-primary/20 hover:border-primary/60"
                      }`}
                    >
                      <div className="relative aspect-square bg-muted grid place-items-center text-3xl">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          "🍣"
                        )}
                        {qty > 0 && (
                          <span className="absolute top-1.5 right-1.5 h-6 min-w-6 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-extrabold grid place-items-center">
                            {qty}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-semibold leading-tight line-clamp-2 min-h-[2.2em]">
                          {p.name}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-1">
                          <span className="text-sm font-extrabold text-primary">{Number(p.price)} ₽</span>
                          {qty === 0 ? (
                            <button
                              onClick={() => inc(p.id)}
                              className="h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:opacity-90"
                              aria-label="Добавить"
                            >
                              +
                            </button>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => dec(p.id)}
                                className="h-6 w-6 rounded-full bg-muted hover:bg-muted/70 font-bold text-xs"
                              >
                                −
                              </button>
                              <button
                                onClick={() => inc(p.id)}
                                className="h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-xs hover:opacity-90"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!visible.length && (
                  <div className="col-span-full text-center text-sm text-muted-foreground py-8">
                    Загружаем меню…
                  </div>
                )}
              </div>
            </div>

            {/* summary */}
            <div className="rounded-2xl bg-card border-2 border-dashed border-primary/30 p-5 h-fit lg:sticky lg:top-32">
              <div className="text-sm font-bold mb-3">Ваш расчёт</div>
              {Object.keys(picks).length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">
                  Выберите блюда слева — мы посчитаем сумму.
                </div>
              ) : (
                <ul className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {Object.entries(picks).map(([id, qty]) => {
                    const p = products.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <li key={id} className="flex items-center justify-between text-xs gap-2">
                        <span className="flex-1 truncate">
                          {p.name} <span className="text-muted-foreground">× {qty}</span>
                        </span>
                        <span className="font-bold tabular-nums">
                          {Math.round(Number(p.price) * qty)} ₽
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="text-muted-foreground">Подсчёт:</span>
                <span className="font-bold">{Math.round(draft)} ₽</span>
              </div>
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-muted-foreground">С корзиной:</span>
                <span className="text-2xl font-extrabold text-primary">{Math.round(total)} ₽</span>
              </div>
              <button
                onClick={onOpenCart}
                className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-lg hover:shadow-primary/40 transition-all"
              >
                {free ? "В корзину со скидкой →" : "Открыть корзину →"}
              </button>
              {Object.keys(picks).length > 0 && (
                <button
                  onClick={() => setPicks({})}
                  className="w-full mt-2 text-xs text-muted-foreground hover:text-primary"
                >
                  Сбросить расчёт
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
