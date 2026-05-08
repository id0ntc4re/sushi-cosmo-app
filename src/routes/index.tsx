import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useFavorites, pushHistory } from "@/lib/favorites";
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

const TAG_OPTIONS = [
  { id: "spicy", label: "🌶 Острое" },
  { id: "vegan", label: "🌱 Веган" },
  { id: "no_fish", label: "🚫🐟 Без рыбы" },
  { id: "baked", label: "🔥 Запечённые" },
  { id: "new", label: "✨ Новинка" },
];

function Index() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [slide, setSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>(FALLBACK_SLIDES as any);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const cart = useCart();
  const fav = useFavorites();

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    (async () => {
      const [cats, prods, bans] = await Promise.all([
        supabase.from("categories").select("id,name,slug").eq("is_active", true).order("sort_order"),
        supabase.from("products").select("id,name,price,weight,category_id,image_url,description,is_addon,tags").eq("is_active", true).order("sort_order"),
        supabase.from("banners").select("image_url,eyebrow,title,subtitle,cta_label,cta_link").eq("is_active", true).order("sort_order"),
      ]);
      setCategories(cats.data ?? []);
      const list = (prods.data as Product[]) ?? [];
      setProducts(list);
      const top = Math.max(0, ...list.map((p) => Number(p.price) || 0));
      setMaxPrice(Math.ceil(top / 100) * 100 || 1000);
      if (bans.data && bans.data.length) setBanners(bans.data as Banner[]);
    })();
  }, []);

  const [priceCap, setPriceCap] = useState<number | null>(null);
  useEffect(() => { if (maxPrice && priceCap === null) setPriceCap(maxPrice); }, [maxPrice, priceCap]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (p.is_addon) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      if (activeTags.length && !activeTags.every((t) => (p.tags ?? []).includes(t))) return false;
      if (priceCap !== null && Number(p.price) > priceCap) return false;
      return true;
    });
  }, [products, search, activeTags, priceCap]);

  const toggleTag = (id: string) => setActiveTags((cur) => cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]);

  const visibleCats = useMemo(
    () => (active ? categories.filter((c) => c.id === active) : categories),
    [categories, active],
  );

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-100">
        <div className="mx-auto max-w-[1280px] px-6 h-20 flex items-center gap-10">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="КосмоСуши" className="h-10 w-10" />
            <span className="font-extrabold text-[22px] tracking-tight">
              КосмоСуши
            </span>
          </a>
          <div className="hidden md:flex items-center gap-2 text-[15px] text-neutral-700">
            <span className="text-primary">📍</span>
            <span>Кемерово</span>
          </div>
          <nav className="ml-auto hidden lg:flex items-center gap-7 text-[15px] font-medium text-neutral-800">
            <a href="#menu" className="hover:text-primary">Меню</a>
            <a href="#delivery" className="hover:text-primary">Доставка</a>
            <a href="#contacts" className="hover:text-primary">Контакты</a>
            <Link to="/account" className="hover:text-primary">Кабинет</Link>
          </nav>
          <a
            href="tel:+79132869284"
            className="hidden md:inline-block font-extrabold text-[17px] text-neutral-900 hover:text-primary"
          >
            +7 913 286 92-84
          </a>
          <button
            onClick={() => cart.setOpen(true)}
            className="relative ml-2 px-5 py-2.5 rounded-full bg-primary text-white font-bold hover:opacity-90 flex items-center gap-2"
          >
            🛒 Корзина
            {cart.count > 0 && (
              <span className="bg-white text-primary text-xs font-extrabold rounded-full h-5 min-w-5 px-1.5 grid place-items-center">
                {cart.count}
              </span>
            )}
          </button>
        </div>
      </header>

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
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur grid place-items-center text-white text-2xl"
              aria-label="Назад"
            >
              ‹
            </button>
            <button
              onClick={() => setSlide((s) => (s + 1) % banners.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur grid place-items-center text-white text-2xl"
              aria-label="Вперёд"
            >
              ›
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

      {/* COME TO US BLOCK */}
      <section className="mx-auto max-w-[1280px] px-6 mt-10">
        <div className="flex items-center gap-3 mb-5">
          <img src={logo} alt="" className="h-7 w-7" />
          <h2 className="text-2xl md:text-3xl font-extrabold">Приходи к нам!</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-neutral-100 p-5">
            <div className="text-sm text-neutral-500">Адрес</div>
            <div className="font-bold text-lg">пр-т Шахтёров, 68</div>
          </div>
          <div className="rounded-2xl bg-neutral-100 p-5">
            <div className="text-sm text-neutral-500">Адрес</div>
            <div className="font-bold text-lg">Бр Строителей, 21</div>
          </div>
        </div>
      </section>

      {/* MENU */}
      <section id="menu" className="mx-auto max-w-[1280px] px-6 mt-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <h2 className="text-3xl md:text-4xl font-extrabold">Меню</h2>
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по меню…"
              className="w-full pl-11 pr-4 py-3 rounded-full bg-neutral-100 focus:bg-white border border-transparent focus:border-primary outline-none transition"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
          </div>
        </div>

        {/* category pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-8 -mx-6 px-6 sticky top-0 bg-white/95 backdrop-blur z-30">
          <button
            onClick={() => setActive(null)}
            className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold transition ${
              active === null
                ? "bg-primary text-white"
                : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
            }`}
          >
            Всё
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-semibold transition ${
                active === c.id
                  ? "bg-primary text-white"
                  : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {visibleCats.map((cat) => {
          const list = filteredProducts.filter((p) => p.category_id === cat.id);
          if (!list.length) return null;
          return (
            <div key={cat.id} className="mb-14">
              <h3 className="text-2xl md:text-3xl font-extrabold mb-6">{cat.name}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {list.map((p) => (
                  <article
                    key={p.id}
                    className="bg-white rounded-3xl overflow-hidden border border-neutral-100 hover:shadow-lg transition flex flex-col"
                  >
                    <div className="relative aspect-square bg-neutral-50 grid place-items-center text-6xl">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        "🍣"
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); fav.toggle(p.id); }}
                        className="absolute top-2 right-2 h-9 w-9 rounded-full bg-white/90 backdrop-blur grid place-items-center text-lg shadow hover:scale-110 transition"
                        aria-label="В избранное"
                      >
                        {fav.has(p.id) ? "❤️" : "🤍"}
                      </button>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h4 className="font-bold leading-snug line-clamp-2">{p.name}</h4>
                      {p.weight && (
                        <div className="text-xs text-neutral-500 mt-1">{p.weight}</div>
                      )}
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
      <footer id="contacts" className="bg-neutral-900 text-white mt-16">
        <div className="mx-auto max-w-[1280px] px-6 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src={logo} alt="" className="h-8 w-8" />
              <div className="text-xl font-extrabold">КосмоСуши</div>
            </div>
            <p className="opacity-70 text-sm">Доставка суши и роллов в Кемерово.</p>
          </div>
          <div id="delivery">
            <div className="font-bold mb-3">Адреса и доставка</div>
            <p className="opacity-80 text-sm leading-7">
              г. Кемерово, пр-т Шахтёров, 68<br />
              г. Кемерово, Бр Строителей, 21<br />
              Ежедневно с 10:00 до 22:00
            </p>
          </div>
          <div>
            <div className="font-bold mb-3">Контакты</div>
            <a href="tel:+79132869284" className="text-primary text-2xl font-extrabold">
              +7 913 286 92-84
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
