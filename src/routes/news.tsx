import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Акции и новости — КосмоСуши" },
      { name: "description", content: "Актуальные акции, скидки и новости КосмоСуши Кемерово." },
      { property: "og:title", content: "Акции и новости — КосмоСуши" },
      { property: "og:description", content: "Скидки на день рождения, самовывоз, бонусная программа и другие акции." },
    ],
  }),
  component: NewsList,
});

type Post = { id: string; slug: string; title: string; excerpt: string | null; image_url: string | null; kind: string };

function NewsList() {
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("news_posts")
        .select("id,slug,title,excerpt,image_url,kind")
        .eq("is_active", true)
        .order("sort_order")
        .order("published_at", { ascending: false });
      setItems((data as Post[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-sm text-muted-foreground mb-2">Главная — Акции и новости</p>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-8">Акции и новости</h1>

        {loading ? (
          <div className="text-muted-foreground">Загружаем…</div>
        ) : !items.length ? (
          <div className="text-muted-foreground">Пока нет публикаций.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((p) => (
              <Link
                key={p.id}
                to="/news/$slug"
                params={{ slug: p.slug }}
                className="group block rounded-3xl overflow-hidden border bg-card hover:border-primary hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all"
              >
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="w-full h-full grid place-items-center">
                      <Sparkles className="h-10 w-10 text-primary/60" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                    {p.kind === "promo" ? "Акция" : "Новость"}
                  </span>
                  <h2 className="font-extrabold text-lg leading-snug mb-2 group-hover:text-primary transition">{p.title}</h2>
                  {p.excerpt && <p className="text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
