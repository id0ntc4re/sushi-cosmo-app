import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

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

const PERSONS = [
  { n: 1, label: "1 человек", emoji: "🙂", hint: "лёгкий перекус" },
  { n: 2, label: "2 человека", emoji: "💑", hint: "ужин на двоих" },
  { n: 4, label: "3-4 человека", emoji: "👨‍👩‍👧", hint: "семейный заказ" },
  { n: 6, label: "5+ человек", emoji: "🎉", hint: "вечеринка" },
];

const OCCASIONS = [
  { id: "dinner", label: "Просто поужинать", emoji: "🍽️", boost: ["Филадельфия", "Калифорния"] },
  { id: "party", label: "Вечеринка / День рождения", emoji: "🎂", boost: ["сет", "ассорти"] },
  { id: "spicy", label: "Хочу остренького 🌶", emoji: "🔥", boost: ["острый", "спайси", "запечён"] },
  { id: "light", label: "Лёгкое и классика", emoji: "🌿", boost: ["филадельфия", "ролл", "суши"] },
];

export function DeliveryCalculator({ subtotal, onOpenCart }: Props) {
  const cart = useCart();
  const [freeFrom, setFreeFrom] = useState(1500);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [persons, setPersons] = useState<number | null>(null);
  const [occasion, setOccasion] = useState<string | null>(null);
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
          .limit(80),
      ]);
      setCategories((cats.data as Category[]) ?? []);
      setProducts((prods.data as Product[]) ?? []);
    })();
  }, []);

  // Suggested products based on occasion + persons
  const suggested = useMemo(() => {
    if (!products.length) return [];
    const occ = OCCASIONS.find((o) => o.id === occasion);
    const boosts = occ?.boost ?? [];
    const scored = products.map((p) => {
      const name = p.name.toLowerCase();
      const score = boosts.reduce((s, b) => s + (name.includes(b.toLowerCase()) ? 10 : 0), 0);
      return { p, score };
    });
    scored.sort((a, b) => b.score - a.score || Number(b.p.price) - Number(a.p.price));
    const limit = persons ? Math.min(12, Math.max(6, persons * 3)) : 9;
    return scored.slice(0, limit).map((x) => x.p);
  }, [products, occasion, persons]);

  const draft = useMemo(
    () =>
      Object.entries(picks).reduce((s, [id, qty]) => {
        const p = products.find((x) => x.id === id);
        return s + (p ? Number(p.price) * qty : 0);
      }, 0),
    [picks, products],
  );

  // Recommended budget per person
  const recommended = useMemo(() => (persons ? persons * 600 : freeFrom), [persons, freeFrom]);

  const total = subtotal + draft;
  const left = Math.max(0, freeFrom - total);
  const pct = Math.min(100, (total / freeFrom) * 100);
  const free = left === 0;

  const inc = (id: string) => setPicks((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
  const dec = (id: string) =>
    setPicks((p) => {
      const n = (p[id] ?? 0) - 1;
      const next = { ...p };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });

  const addAllToCart = () => {
    let count = 0;
    Object.entries(picks).forEach(([id, qty]) => {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      cart.add(
        { id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url, weight: p.weight },
        qty,
      );
      count += qty;
    });
    toast.success(`Добавлено ${count} позиций в корзину 🎉`);
    setPicks({});
    onOpenCart();
  };

  const STEPS = [
    { n: 1, label: "Сколько вас" },
    { n: 2, label: "Что хочется" },
    { n: 3, label: "Соберите заказ" },
  ];

  return (
    <section className="mx-auto max-w-[1280px] px-6 mt-10">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-muted blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-muted blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-foreground text-xs font-bold uppercase tracking-wider">
                ✨ Помощник заказа · 30 секунд
              </div>
              <h2 className="mt-3 text-3xl md:text-4xl font-extrabold leading-tight text-foreground">
                Соберём идеальный заказ за 3 шага
              </h2>
              <p className="mt-1 text-muted-foreground text-sm md:text-base">
                Подскажем, что взять, сколько порций и сколько это будет стоить — без сюрпризов.
              </p>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 md:gap-4 mb-6 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const done = step > s.n;
              const active = step === s.n;
              return (
                <div key={s.n} className="flex items-center gap-2 md:gap-4 shrink-0">
                  <button
                    onClick={() => {
                      if (s.n === 1) setStep(1);
                      if (s.n === 2 && persons) setStep(2);
                      if (s.n === 3 && persons && occasion) setStep(3);
                    }}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-bold transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : done
                        ? "bg-muted text-foreground hover:bg-muted"
                        : "bg-card border border-border text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-6 w-6 rounded-full grid place-items-center text-xs ${
                        active
                          ? "bg-primary-foreground text-primary"
                          : done
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {done ? "✓" : s.n}
                    </span>
                    <span className="whitespace-nowrap">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`h-0.5 w-4 md:w-10 rounded-full ${done ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* STEP 1: persons */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h3 className="text-lg md:text-xl font-bold mb-4">На сколько человек заказ?</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PERSONS.map((opt) => {
                  const on = persons === opt.n;
                  return (
                    <button
                      key={opt.n}
                      onClick={() => {
                        setPersons(opt.n);
                        setTimeout(() => setStep(2), 200);
                      }}
                      className={`group relative rounded-2xl p-5 text-left border transition-all ${
                        on
                          ? "border-primary bg-muted shadow-lg shadow-primary/20"
                          : "border-primary/30 bg-card hover:border-primary hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="text-3xl mb-2">{opt.emoji}</div>
                      <div className="font-extrabold">{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{opt.hint}</div>
                      <div className="text-xs font-bold text-primary mt-2">от {opt.n * 600} ₽</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: occasion */}
          {step === 2 && (
            <div className="animate-fade-in">
              <h3 className="text-lg md:text-xl font-bold mb-4">Что вам ближе?</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {OCCASIONS.map((opt) => {
                  const on = occasion === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setOccasion(opt.id);
                        setTimeout(() => setStep(3), 200);
                      }}
                      className={`group rounded-2xl p-5 text-left border transition-all ${
                        on
                          ? "border-primary bg-muted shadow-lg shadow-primary/20"
                          : "border-primary/30 bg-card hover:border-primary hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="text-3xl mb-2">{opt.emoji}</div>
                      <div className="font-extrabold leading-tight">{opt.label}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  ← Назад
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: pick products */}
          {step === 3 && (
            <div className="animate-fade-in grid lg:grid-cols-[1fr_320px] gap-6">
              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-lg md:text-xl font-bold">
                    Подобрали {suggested.length} блюд для вас
                  </h3>
                  <div className="text-xs text-muted-foreground">
                    Реком. бюджет:{" "}
                    <span className="font-bold text-primary">≈ {recommended} ₽</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {suggested.map((p) => {
                    const qty = picks[p.id] ?? 0;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl bg-card border transition-all overflow-hidden ${
                          qty > 0
                            ? "border-primary shadow-md shadow-primary/20"
                            : "border-primary/20 hover:border-foreground/30"
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
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    ← Назад
                  </button>
                  <a href="#menu" className="text-sm text-primary font-semibold hover:underline">
                    Смотреть всё меню →
                  </a>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-2xl bg-card border border-border p-5 h-fit lg:sticky lg:top-32">
                <div className="text-sm font-bold mb-3">Ваш заказ</div>

                {Object.keys(picks).length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border border-border rounded-xl">
                    👉 Выберите блюда слева
                  </div>
                ) : (
                  <ul className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
                    {Object.entries(picks).map(([id, qty]) => {
                      const p = products.find((x) => x.id === id);
                      if (!p) return null;
                      return (
                        <li key={id} className="flex items-center justify-between text-xs gap-2">
                          <span className="flex-1 truncate">
                            {p.name} <span className="text-muted-foreground">×{qty}</span>
                          </span>
                          <span className="font-bold tabular-nums">
                            {Math.round(Number(p.price) * qty)} ₽
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-[11px] font-semibold mb-1">
                    <span className="text-muted-foreground">
                      {free ? "🎉 Бесплатная доставка!" : `До бесплатной доставки ${left} ₽`}
                    </span>
                    <span className="text-primary">{freeFrom} ₽</span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm pt-3 border-t border-border">
                  <span className="text-muted-foreground">Итого:</span>
                  <span className="text-2xl font-extrabold text-primary">
                    {Math.round(draft)} ₽
                  </span>
                </div>

                <button
                  onClick={addAllToCart}
                  disabled={Object.keys(picks).length === 0}
                  className="w-full mt-4 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-lg hover:shadow-primary/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  В корзину →
                </button>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground justify-center">
                  <span>🚚 Доставка 60 мин</span>
                  <span>·</span>
                  <span>💳 Оплата при получении</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
