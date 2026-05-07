import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.svg";

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
};

function Index() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase
        .from("categories")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("sort_order");
      const { data: prods } = await supabase
        .from("products")
        .select("id,name,price,weight,category_id,image_url,description")
        .eq("is_active", true)
        .order("sort_order");
      setCategories(cats ?? []);
      setProducts((prods as Product[]) ?? []);
    })();
  }, []);

  const visibleCats = useMemo(
    () => (active ? categories.filter((c) => c.id === active) : categories),
    [categories, active],
  );

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* TOP HEADER */}
      <header className="bg-white border-b border-neutral-100">
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
          </nav>
          <a
            href="tel:+79132869284"
            className="hidden md:inline-block font-extrabold text-[17px] text-neutral-900 hover:text-primary"
          >
            +7 913 286 92-84
          </a>
        </div>
      </header>

      {/* HERO BANNER */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1280px] px-6 pt-6">
          <div className="relative rounded-[32px] overflow-hidden bg-gradient-to-br from-primary via-orange-500 to-red-500 aspect-[16/6] grid place-items-center text-white">
            <div className="text-center px-8">
              <h1 className="text-3xl md:text-5xl font-extrabold drop-shadow-md">
                Свежие суши и роллы
              </h1>
              <p className="mt-3 md:text-xl opacity-95">
                Доставка по Кемерово ежедневно с 10:00 до 22:00
              </p>
              <a
                href="#menu"
                className="inline-block mt-6 px-8 py-3 rounded-full bg-white text-primary font-bold shadow-lg hover:bg-neutral-100"
              >
                Смотреть меню
              </a>
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
        <h2 className="text-3xl md:text-4xl font-extrabold mb-6">Меню</h2>

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
          const list = products.filter((p) => p.category_id === cat.id);
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
                    <div className="aspect-square bg-neutral-50 grid place-items-center text-6xl">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        "🍣"
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h4 className="font-bold leading-snug line-clamp-2">{p.name}</h4>
                      {p.weight && (
                        <div className="text-xs text-neutral-500 mt-1">{p.weight}</div>
                      )}
                      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                        <span className="text-xl font-extrabold">{Number(p.price)} ₽</span>
                        <button className="px-4 py-2 rounded-full bg-primary text-white font-semibold hover:opacity-90 text-sm">
                          В корзину
                        </button>
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
