import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useFavorites, pushHistory } from "@/lib/favorites";
import { ChevronLeft, ChevronRight, Truck, Fish, Sparkles, Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { DeliveryCalculator } from "@/components/DeliveryCalculator";
import logo from "@/assets/logo.svg";
import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";

const FALLBACK_SLIDES = [
  { image_url: hero1, eyebrow: "Хит сезона", title: "Свежие суши и роллы", subtitle: "Доставка по Кемерово ежедневно с 10:00 до 22:00", cta_label: "Смотреть меню", cta_link: "#menu" },
  { image_url: hero2, eyebrow: "Классика", title: "Ассорти из лосося и тунца", subtitle: "Только свежая рыба и нежный рис каждый день", cta_label: "Заказать сет", cta_link: "#menu" },
  { image_url: hero3, eyebrow: "Новинка", title: "Горячие запечённые роллы", subtitle: "Тающий сыр, острый соус и хрустящая корочка", cta_label: "Попробовать", cta_link: "#menu" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "КосмоСуши — доставка суши и роллов в Кемерово" },
      { name: "description", content: "Доставка суши, роллов и наборов в Кемерово ежедневно с 10:00 до 22:00." },
    ],
  }),
  component: Index,
});

type Category = { id: string; name: string; slug: string };
type Product = {
  id: string;
  name: string;
  price: number;
  weight: string | null;
  category_id: string | null;
  image_url: string | null;
  description?: string | null;
  ingredients?: string | null;
  is_addon?: boolean;
  tags?: string[];
};
type Banner = {
  image_url: string | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  cta_label: string | null;
  cta_link: string | null;
};


function Index() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [slide, setSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>(FALLBACK_SLIDES as any);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const cart = useCart();
  const fav = useFavorites();

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const prods = await supabase
          .from("products")
          .select("id,name,price,weight,category_id,image_url,description,ingredients,is_addon,tags")
          .eq("is_active", true)
          .order("sort_order");
        if (prods.error) throw prods.error;
        const list = (prods.data as Product[]) ?? [];
        setProducts(list);
      } catch (e: any) {
        setLoadError(e?.message ?? "Не удалось загрузить меню");
      } finally {
        setLoading(false);
      }

      const [cats, bans] = await Promise.all([
        supabase.from("categories").select("id,name,slug").eq("is_active", true).order("sort_order"),
        supabase.from("banners").select("image_url,eyebrow,title,subtitle,cta_label,cta_link").eq("is_active", true).order("sort_order"),
      ]);
      if (!cats.error) setCategories(cats.data ?? []);
      if (!bans.error && bans.data && bans.data.length) setBanners(bans.data as Banner[]);
    })();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.is_addon) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search]);

  const visibleCats = useMemo(
    () => {
      if (!categories.length) return [{ id: "all", name: "Меню", slug: "all" }];
      return active ? categories.filter((c) => c.id === active) : categories;
    },
    [categories, active],
  );

  return (
    <div className="min-h-screen bg-white text-foreground">
      <SiteHeader />

      {/* HERO SLIDER */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1280px] px-6 pt-6">
          <div className="relative rounded-[32px] overflow-hidden aspect-[16/7] md:aspect-[16/6] bg-neutral-900 text-white">
            {banners.map((s, i) => (
              <div
                key={i}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  i === slide ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {s.image_url && (
                  <img
                    src={s.image_url}
                    alt={s.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                <div className="relative z-10 h-full flex items-center">
                  <div className="px-8 md:px-14 max-w-2xl animate-fade-in" key={`c-${i}-${slide}`}>
                    {s.eyebrow && (
                      <span className="inline-block px-3 py-1 rounded-full bg-primary/90 text-white text-xs font-bold uppercase tracking-wider">
                        {s.eyebrow}
                      </span>
                    )}
                    <h1 className="mt-4 text-3xl md:text-5xl lg:text-6xl font-extrabold leading-tight drop-shadow-lg">
                      {s.title}
                    </h1>
                    {s.subtitle && <p className="mt-3 md:text-xl opacity-95 max-w-lg">{s.subtitle}</p>}
                    {s.cta_label && (
                      <a
                        href={s.cta_link || "#menu"}
                        className="inline-block mt-6 px-8 py-3.5 rounded-full bg-primary text-white font-bold shadow-xl hover:bg-primary/90 transition"
                      >
                        {s.cta_label} →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* arrows */}
            <button
              onClick={() => setSlide((s) => (s - 1 + banners.length) % banners.length)}
              className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 z-30 h-11 w-11 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur flex items-center justify-center text-white"
              aria-label="Назад"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => setSlide((s) => (s + 1) % banners.length)}
              className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 z-30 h-11 w-11 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur flex items-center justify-center text-white"
              aria-label="Вперёд"
            >
              <ChevronRight className="h-6 w-6" />
            </button>

            {/* dots */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === slide ? "bg-white w-8" : "bg-white/50 w-2 hover:bg-white/80"
                  }`}
                  aria-label={`Слайд ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-[1280px] px-6 mt-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { Icon: Truck, title: "Бесплатно от 1500 ₽", text: "Доставим в течение часа" },
            { Icon: Fish, title: "Свежая рыба", text: "Поставки каждый день" },
            { Icon: Sparkles, title: "Бонусы за заказ", text: "Копите и оплачивайте" },
            { Icon: Clock, title: "10:00 – 22:00", text: "Работаем без выходных" },
          ].map(({ Icon, title, text }) => (
            <div key={title} className="group rounded-2xl bg-card p-5 border border-border hover:border-foreground/20 hover:shadow-md transition-all">
              <div className="h-11 w-11 rounded-xl bg-muted grid place-items-center mb-3 group-hover:bg-primary/10 transition-colors">
                <Icon className="h-5 w-5 text-primary" strokeWidth={2} />
              </div>
              <div className="font-bold leading-tight">{title}</div>
              <div className="text-sm text-muted-foreground mt-1">{text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DELIVERY CALCULATOR CTA */}
      <DeliveryCalculator subtotal={cart.subtotal} onOpenCart={() => cart.setOpen(true)} products={products.filter((p) => !p.is_addon)} />

      {/* MENU */}
      <section id="menu" className="mx-auto max-w-[1280px] px-6 mt-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-3">
            <span className="h-10 w-1.5 rounded-full bg-gradient-to-b from-primary to-primary/40" />
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">Меню</h2>
          </div>
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по меню…"
              className="w-full pl-11 pr-4 py-3 rounded-full bg-card border border-border focus:border-primary focus:border-solid outline-none transition"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">🔍</span>

          </div>
        </div>

        {/* category pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-8 -mx-6 px-6 sticky top-0 bg-background/95 backdrop-blur z-30">
          <button
            onClick={() => setActive(null)}
            className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              active === null
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                : "bg-card border border-border hover:border-primary"
            }`}
          >
            Всё
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                active === c.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "bg-card border border-border hover:border-primary"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>


        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl overflow-hidden border border-neutral-100">
                <div className="aspect-square bg-neutral-100 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-neutral-100 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-neutral-100 rounded animate-pulse" />
                  <div className="h-8 bg-neutral-100 rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && loadError && (
          <div className="text-center py-12 text-red-600">
            <p className="font-bold mb-2">Ошибка загрузки меню</p>
            <p className="text-sm text-neutral-500 mb-4">{loadError}</p>
            <button onClick={() => location.reload()} className="px-6 py-2.5 rounded-full bg-primary text-white font-bold">
              Обновить
            </button>
          </div>
        )}
        {!loading && !loadError && filteredProducts.length === 0 && products.length > 0 && (
          <div className="text-center py-12 text-neutral-500">
            Ничего не найдено. Попробуйте сбросить фильтры.
          </div>
        )}
        {!loading && visibleCats.map((cat) => {
          const list = cat.id === "all" ? filteredProducts : filteredProducts.filter((p) => p.category_id === cat.id);
          if (!list.length) return null;
          return (
            <div key={cat.id} className="mb-14">
              <div className="flex items-center gap-3 mb-6">
                <span className="h-8 w-1.5 rounded-full bg-gradient-to-b from-primary to-primary/40" />
                <h3 className="text-2xl md:text-3xl font-extrabold text-foreground">{cat.name}</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {list.map((p) => (
                  <article
                    key={p.id}
                    className="group bg-card rounded-3xl overflow-hidden border border-border hover:border-primary hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenProduct(p)}
                      className="relative aspect-square bg-neutral-50 grid place-items-center text-6xl text-left w-full"
                      aria-label={`Подробнее о ${p.name}`}
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        "🍣"
                      )}
                      <span
                        onClick={(e) => { e.stopPropagation(); fav.toggle(p.id); }}
                        className="absolute top-2 right-2 h-9 w-9 rounded-full bg-white/90 backdrop-blur grid place-items-center text-lg shadow hover:scale-110 transition cursor-pointer"
                        aria-label="В избранное"
                      >
                        {fav.has(p.id) ? "❤️" : "🤍"}
                      </span>
                    </button>
                    <div className="p-4 flex flex-col flex-1">
                      <button type="button" onClick={() => setOpenProduct(p)} className="text-left">
                        <h4 className="font-bold leading-snug line-clamp-2 hover:text-primary transition">{p.name}</h4>
                        {p.weight && (
                          <div className="text-xs text-neutral-500 mt-1">{p.weight}</div>
                        )}
                      </button>
                      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                        <span className="text-xl font-extrabold">{Number(p.price)} ₽</span>
                        {(() => {
                          const inCart = cart.items.find((i) => i.id === p.id);
                          if (inCart) {
                            return (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => cart.setQty(p.id, inCart.quantity - 1)}
                                  className="h-8 w-8 rounded-full bg-neutral-100 hover:bg-neutral-200 font-bold"
                                  aria-label="Уменьшить"
                                >
                                  −
                                </button>
                                <span className="w-7 text-center font-bold">{inCart.quantity}</span>
                                <button
                                  onClick={() => cart.setQty(p.id, inCart.quantity + 1)}
                                  className="h-8 w-8 rounded-full bg-primary text-white hover:opacity-90 font-bold"
                                  aria-label="Увеличить"
                                >
                                  +
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              onClick={() => {
                                cart.add({
                                  id: p.id,
                                  name: p.name,
                                  price: Number(p.price),
                                  image_url: p.image_url,
                                  weight: p.weight,
                                });
                                pushHistory(p.id);
                                toast.success("Добавлено в корзину", { description: p.name });
                              }}
                              className="px-4 py-2 rounded-full bg-primary text-white font-semibold hover:opacity-90 text-sm"
                            >
                              В корзину
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}

        {!products.length && (
          <div className="py-20 text-center text-neutral-500">Загружаем меню…</div>
        )}
        {products.length > 0 && search && filteredProducts.length === 0 && (
          <div className="py-20 text-center text-neutral-500">
            По запросу «{search}» ничего не найдено
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer id="contacts" className="relative mt-16 bg-gradient-to-br from-foreground via-foreground to-foreground/90 text-background">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-primary to-primary/60" />
        <div className="mx-auto max-w-[1280px] px-6 py-14 grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-muted rounded-full blur-xl" />
                <img src={logo} alt="" className="h-10 w-10 relative" />
              </div>
              <div className="text-2xl font-extrabold text-background">КосмоСуши</div>
            </div>
            <p className="opacity-70 text-sm">Доставка суши и роллов в Кемерово ежедневно.</p>
          </div>
          <div id="delivery">
            <div className="flex items-center gap-2 font-bold mb-4 text-primary">
              <span className="h-1.5 w-6 rounded-full bg-primary" />
              Адреса и доставка
            </div>
            <ul className="space-y-2 text-sm opacity-90">
              <li className="flex items-start gap-2"><span className="text-primary">📍</span>пр-т Шахтёров, 68</li>
              <li className="flex items-start gap-2"><span className="text-primary">📍</span>Бр Строителей, 21</li>
              <li className="flex items-start gap-2"><span className="text-primary">🕒</span>Ежедневно 10:00–22:00</li>
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 font-bold mb-4 text-primary">
              <span className="h-1.5 w-6 rounded-full bg-primary" />
              Контакты
            </div>
            <a href="tel:+79132869284" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-lg font-extrabold hover:shadow-lg hover:shadow-primary/40 transition-all">
              📞 +7 913 286 92-84
            </a>
          </div>
        </div>
        <div className="border-t border-background/10">
          <div className="mx-auto max-w-[1280px] px-6 py-4 text-xs opacity-60 text-center">
            © {new Date().getFullYear()} КосмоСуши · Все права защищены
          </div>
        </div>
      </footer>

      {openProduct && (
        <ProductModal
          product={openProduct}
          onClose={() => setOpenProduct(null)}
          onAdd={(qty) => {
            cart.add(
              {
                id: openProduct.id,
                name: openProduct.name,
                price: Number(openProduct.price),
                image_url: openProduct.image_url,
                weight: openProduct.weight,
              },
              qty,
            );
            pushHistory(openProduct.id);
            toast.success("Добавлено в корзину", { description: openProduct.name });
            setOpenProduct(null);
          }}
        />
      )}
    </div>
  );
}

function ProductModal({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid place-items-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-3xl overflow-hidden max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/10] bg-neutral-100 grid place-items-center text-7xl">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            "🍣"
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-10 w-10 rounded-full bg-white/95 hover:bg-white grid place-items-center text-xl font-bold shadow"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-2">{product.name}</h2>
          {product.weight && <div className="text-sm text-neutral-500 mb-4">{product.weight}</div>}
          {product.description && (
            <p className="text-foreground/90 leading-relaxed mb-5">{product.description}</p>
          )}
          {product.ingredients && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider font-bold text-primary mb-1">Состав</div>
              <p className="text-sm text-foreground/80">{product.ingredients}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 pt-4 border-t">
            <span className="text-3xl font-extrabold">{Number(product.price)} ₽</span>
            <button
              onClick={onAdd}
              className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-90 transition"
            >
              В корзину
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
