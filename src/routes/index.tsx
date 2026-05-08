import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useFavorites, pushHistory } from "@/lib/favorites";
import { ChevronLeft, ChevronRight, Truck, Fish, Sparkles, Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { DeliveryCalculator } from "@/components/DeliveryCalculator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const cart = useCart();
  const fav = useFavorites();
  const navigate = useNavigate();

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
        <div className="mx-auto max-w-[1280px] px-3 sm:px-6 pt-3 sm:pt-6">
          <div className="relative rounded-2xl sm:rounded-[32px] overflow-hidden aspect-[4/5] sm:aspect-[16/7] md:aspect-[16/6] bg-neutral-900 text-white">
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
                <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-black/80 via-black/50 to-black/10 sm:to-transparent" />
                <div className="relative z-10 h-full flex items-end sm:items-center">
                  <div className="px-5 pb-8 sm:px-8 md:px-14 sm:pb-0 max-w-2xl animate-fade-in" key={`c-${i}-${slide}`}>
                    {s.eyebrow && (
                      <span className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary/90 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                        {s.eyebrow}
                      </span>
                    )}
                    <h1 className="mt-2 sm:mt-4 text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-extrabold leading-tight drop-shadow-lg">
                      {s.title}
                    </h1>
                    {s.subtitle && <p className="mt-2 sm:mt-3 text-sm sm:text-base md:text-xl opacity-95 max-w-lg">{s.subtitle}</p>}
                    {s.cta_label && (
                      <a
                        href={s.cta_link || "#menu"}
                        className="inline-block mt-4 sm:mt-6 px-5 py-2.5 sm:px-8 sm:py-3.5 rounded-full bg-primary text-white font-bold text-sm sm:text-base shadow-xl hover:bg-primary/90 transition"
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
      <section className="mx-auto max-w-[1280px] px-3 sm:px-6 mt-6 sm:mt-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { Icon: Truck, title: "Бесплатно от 1500 ₽", text: "Доставим в течение часа" },
            { Icon: Fish, title: "Свежая рыба", text: "Поставки каждый день" },
            { Icon: Sparkles, title: "Бонусы за заказ", text: "Копите и оплачивайте" },
            { Icon: Clock, title: "10:00 – 22:00", text: "Работаем без выходных" },
          ].map(({ Icon, title, text }) => (
            <div key={title} className="group rounded-2xl bg-card p-3 sm:p-5 border border-border hover:border-foreground/20 hover:shadow-md transition-all">
              <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-muted grid place-items-center mb-2 sm:mb-3 group-hover:bg-primary/10 transition-colors">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" strokeWidth={2} />
              </div>
              <div className="font-bold leading-tight text-sm sm:text-base">{title}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DELIVERY CALCULATOR CTA */}
      <DeliveryCalculator subtotal={cart.subtotal} onOpenCart={() => cart.setOpen(true)} products={products.filter((p) => !p.is_addon)} />

      {/* MENU */}
      <section id="menu" className="mx-auto max-w-[1280px] px-3 sm:px-6 mt-8 sm:mt-12">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="h-8 sm:h-10 w-1.5 rounded-full bg-gradient-to-b from-primary to-primary/40" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground">Меню</h2>
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
        <div className="scrollbar-fancy flex gap-2 overflow-x-auto pb-2.5 mb-6 sm:mb-8 -mx-3 sm:-mx-6 px-3 sm:px-6 sticky top-16 md:top-20 bg-background/95 backdrop-blur z-30">
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!fav.isAuthenticated) { setAuthPromptOpen(true); return; }
                          fav.toggle(p.id);
                        }}
                        className="absolute top-2 right-2 h-9 w-9 rounded-full bg-white/90 backdrop-blur grid place-items-center text-lg shadow hover:scale-110 transition cursor-pointer"
                        aria-label="В избранное"
                      >
                        {fav.has(p.id) ? "❤️" : "🤍"}
                      </span>
                    </button>
                    <div className="p-3 sm:p-4 flex flex-col flex-1">
                      <button type="button" onClick={() => setOpenProduct(p)} className="text-left">
                        <h4 className="font-bold text-sm sm:text-base leading-snug line-clamp-2 hover:text-primary transition">{p.name}</h4>
                        {p.weight && (
                          <div className="text-[11px] sm:text-xs text-neutral-500 mt-1">{p.weight}</div>
                        )}
                      </button>
                      <div className="mt-auto pt-3 sm:pt-4 flex items-center justify-between gap-1.5">
                        <span className="text-base sm:text-xl font-extrabold">{Number(p.price)} ₽</span>
                        {(() => {
                          const inCart = cart.items.find((i) => i.id === p.id);
                          if (inCart) {
                            return (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => cart.setQty(p.id, inCart.quantity - 1)}
                                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-neutral-100 hover:bg-neutral-200 font-bold"
                                  aria-label="Уменьшить"
                                >
                                  −
                                </button>
                                <span className="w-6 sm:w-7 text-center font-bold text-sm sm:text-base">{inCart.quantity}</span>
                                <button
                                  onClick={() => cart.setQty(p.id, inCart.quantity + 1)}
                                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary text-white hover:opacity-90 font-bold"
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
                              className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary text-white font-semibold hover:opacity-90 text-xs sm:text-sm"
                            >
                              <span className="sm:hidden">+</span>
                              <span className="hidden sm:inline">В корзину</span>
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
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-10 sm:py-14 grid sm:grid-cols-2 md:grid-cols-3 gap-8">
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

      <AlertDialog open={authPromptOpen} onOpenChange={setAuthPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Войдите, чтобы добавить в избранное</AlertDialogTitle>
            <AlertDialogDescription>
              Для добавления товаров в избранное необходимо авторизоваться в аккаунте.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate({ to: "/account-login" })}>
              Войти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Reco = { id: string; name: string; price: number; image_url: string | null; weight: string | null };

function ProductModal({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState(1);
  const [recos, setRecos] = useState<Reco[]>([]);
  const cart = useCart();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,price,image_url,weight")
        .eq("is_active", true)
        .eq("in_stock", true)
        .eq("is_recommended", true)
        .neq("id", product.id)
        .limit(8);
      setRecos((data as Reco[]) ?? []);
    })();
  }, [product.id]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 grid sm:place-items-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white sm:rounded-3xl rounded-t-3xl overflow-hidden max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl mt-auto sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/9] sm:aspect-[21/9] bg-neutral-100 grid place-items-center text-5xl max-h-[40vh]">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            "🍣"
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-10 w-10 rounded-full bg-white/95 hover:bg-white grid place-items-center shadow"
            aria-label="Закрыть"
          >
            <span className="block text-2xl font-bold leading-none -mt-0.5">×</span>
          </button>
        </div>
        <div className="p-4 sm:p-6 md:p-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold mb-2">{product.name}</h2>
          {product.weight && <div className="text-sm text-neutral-500 mb-3 sm:mb-4">{product.weight}</div>}
          {product.description && (
            <p className="text-sm sm:text-base text-foreground/90 leading-relaxed mb-4 sm:mb-5">{product.description}</p>
          )}
          {product.ingredients && (
            <div className="mb-5 sm:mb-6">
              <div className="text-xs uppercase tracking-wider font-bold text-primary mb-1">Состав</div>
              <p className="text-sm text-foreground/80">{product.ingredients}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 pt-4 border-t flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold">{Number(product.price) * qty} ₽</span>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 rounded-full border border-neutral-200 px-2 py-1">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="h-8 w-8 rounded-full hover:bg-neutral-100 grid place-items-center text-lg font-bold"
                  aria-label="Уменьшить"
                >
                  −
                </button>
                <span className="min-w-6 text-center font-bold">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="h-8 w-8 rounded-full hover:bg-neutral-100 grid place-items-center text-lg font-bold"
                  aria-label="Увеличить"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => onAdd(qty)}
                className="px-4 py-2.5 sm:px-6 sm:py-3 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-90 transition text-sm sm:text-base"
              >
                В корзину
              </button>
            </div>
          </div>

          {recos.length > 0 && (
            <div className="mt-8 pt-6 border-t">
              <div className="text-sm font-bold text-neutral-700 mb-3">С этим заказывают</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {recos.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-neutral-100 p-2 flex flex-col">
                    <div className="aspect-square rounded-xl bg-neutral-50 grid place-items-center overflow-hidden text-2xl mb-2">
                      {r.image_url ? <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" /> : "🍣"}
                    </div>
                    <div className="text-xs font-semibold line-clamp-2 leading-snug min-h-[2.4em]">{r.name}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-extrabold">{Number(r.price)} ₽</span>
                      <button
                        onClick={() => {
                          cart.add({ id: r.id, name: r.name, price: Number(r.price), image_url: r.image_url, weight: r.weight });
                          toast.success("Добавлено", { description: r.name });
                        }}
                        className="h-7 w-7 rounded-full bg-primary text-white font-bold grid place-items-center"
                        aria-label="Добавить"
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
