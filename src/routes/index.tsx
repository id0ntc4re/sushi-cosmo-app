import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "КосмоСуши — доставка суши и роллов в Кемерово" },
      { name: "description", content: "Доставка суши, роллов и наборов в Кемерово ежедневно с 10:00 до 22:00. Заказ онлайн." },
    ],
  }),
  component: Index,
});

type Category = { id: string; name: string; slug: string };
type Product = { id: string; name: string; price: number; weight: string | null; category_id: string; image_url: string | null };

function Index() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase.from("categories").select("id,name,slug").order("sort_order");
      const { data: prods } = await supabase.from("products").select("id,name,price,weight,category_id,image_url").eq("is_active", true).order("sort_order");
      setCategories(cats ?? []);
      setProducts(prods ?? []);
      if (cats && cats[0]) setActive(cats[0].id);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/30 border-b">
        <div className="mx-auto max-w-7xl px-4 py-14 md:py-20 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
              Свежие суши и роллы <span className="text-primary">за 60 минут</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Готовим из охлаждённого лосося, варим рис каждый час, везём бесплатно от 1500 ₽.
            </p>
            <a href="#menu" className="inline-block mt-8 px-7 py-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg hover:opacity-90 transition">
              Перейти в меню
            </a>
          </div>
          <div className="hidden md:block">
            <div className="aspect-square rounded-3xl bg-primary/20 grid place-items-center text-9xl">🍣</div>
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-3xl font-bold mb-6">Меню</h2>
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 sticky top-20 bg-background/95 backdrop-blur z-30 -mx-4 px-4">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`shrink-0 px-5 py-2.5 rounded-full font-semibold text-sm border transition ${
                active === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {categories.filter((c) => !active || c.id === active).map((cat) => (
          <div key={cat.id} className="mb-12">
            <h3 className="text-2xl font-bold mb-5">{cat.name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {products.filter((p) => p.category_id === cat.id).map((p) => (
                <article key={p.id} className="group bg-card rounded-2xl overflow-hidden border hover:shadow-xl transition flex flex-col">
                  <div className="aspect-square bg-muted grid place-items-center text-6xl">🍱</div>
                  <div className="p-4 flex flex-col flex-1">
                    <h4 className="font-bold leading-tight">{p.name}</h4>
                    {p.weight && <div className="text-xs text-muted-foreground mt-1">{p.weight}</div>}
                    <div className="mt-auto pt-4 flex items-center justify-between">
                      <span className="text-xl font-extrabold">{Number(p.price)} ₽</span>
                      <button className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-semibold hover:bg-primary hover:text-primary-foreground transition text-sm">
                        В корзину
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>

      <footer id="contacts" className="bg-foreground text-background mt-12">
        <div className="mx-auto max-w-7xl px-4 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-2xl font-bold mb-3">КосмоСуши</div>
            <p className="opacity-70 text-sm">Доставка суши и роллов в Кемерово ежедневно.</p>
          </div>
          <div>
            <div className="font-bold mb-3">Адреса</div>
            <p className="opacity-80 text-sm leading-7">г. Кемерово, пр-т Шахтёров, 68<br/>г. Кемерово, Бр Строителей, 21</p>
          </div>
          <div>
            <div className="font-bold mb-3">Контакты</div>
            <a href="tel:+79132869284" className="text-primary text-xl font-bold">+7 913 286 92-84</a>
            <p className="opacity-80 text-sm mt-2">Доставка ежедневно с 10:00 до 22:00</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
