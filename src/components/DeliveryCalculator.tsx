import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  subtotal: number;
  onOpenCart: () => void;
};

export function DeliveryCalculator({ subtotal, onOpenCart }: Props) {
  const [freeFrom, setFreeFrom] = useState(1500);
  const [draft, setDraft] = useState<number>(0);

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
  }, []);

  const total = subtotal + draft;
  const left = Math.max(0, freeFrom - total);
  const pct = Math.min(100, (total / freeFrom) * 100);
  const free = left === 0;

  return (
    <section className="mx-auto max-w-[1280px] px-6 mt-10">
      <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative grid md:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider">
              🚚 Калькулятор доставки
            </div>
            <h2 className="mt-3 text-3xl md:text-4xl font-extrabold leading-tight bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              {free
                ? "Ура! Доставка бесплатная 🎉"
                : `До бесплатной доставки осталось ${left} ₽`}
            </h2>
            <p className="mt-2 text-muted-foreground text-sm md:text-base">
              Бесплатная доставка по Кемерово при заказе от{" "}
              <span className="font-bold text-foreground">{freeFrom} ₽</span>.
              Прибавьте к корзине ещё немного — и платить за доставку не придётся.
            </p>

            <div className="mt-6">
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span className="text-muted-foreground">
                  В корзине: <span className="text-foreground font-bold">{Math.round(subtotal)} ₽</span>
                  {draft > 0 && <span className="text-primary"> +{draft} ₽</span>}
                </span>
                <span className="text-primary">{freeFrom} ₽</span>
              </div>
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 rounded-full"
                  style={{ width: `${pct}%` }}
                />
                {pct > 0 && pct < 100 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-primary border-2 border-background shadow-lg transition-all"
                    style={{ left: `calc(${pct}% - 10px)` }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card border-2 border-dashed border-primary/30 p-5">
            <div className="text-sm font-bold mb-3">Прикинуть заказ</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[300, 500, 800, 1000, 1500, 2000].map((v) => (
                <button
                  key={v}
                  onClick={() => setDraft((d) => (d === v ? 0 : v))}
                  className={`py-2 rounded-full text-sm font-semibold transition-all ${
                    draft === v
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "bg-background border-2 border-dashed border-primary/30 hover:border-primary"
                  }`}
                >
                  +{v} ₽
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mb-4 text-sm">
              <span className="text-muted-foreground">Итого:</span>
              <span className="text-2xl font-extrabold text-primary">{Math.round(total)} ₽</span>
            </div>
            <button
              onClick={onOpenCart}
              className="w-full py-3 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-lg hover:shadow-primary/40 transition-all"
            >
              {free ? "Оформить со скидкой на доставку →" : "Открыть корзину →"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
