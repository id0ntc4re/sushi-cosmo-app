import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/news/$slug")({
  component: NewsDetail,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-muted-foreground">Публикация не найдена</div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center text-destructive">{error.message}</div>
  ),
});

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  kind: string;
  published_at: string;
};

function NewsDetail() {
  const { slug } = Route.useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("news_posts")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      setPost(data as Post | null);
      setLoading(false);
    })();
  }, [slug]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <Link to="/news" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" /> Все акции и новости
        </Link>

        {loading ? (
          <div className="text-muted-foreground">Загружаем…</div>
        ) : !post ? (
          <div className="text-muted-foreground">Публикация не найдена.</div>
        ) : (
          <article>
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
              {post.kind === "promo" ? "Акция" : "Новость"}
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-4">{post.title}</h1>
            {post.image_url && (
              <img src={post.image_url} alt={post.title} className="w-full rounded-3xl mb-6 object-cover aspect-[16/9]" />
            )}
            {post.excerpt && <p className="text-lg text-muted-foreground mb-6">{post.excerpt}</p>}
            <div className="prose prose-lg max-w-none whitespace-pre-line text-foreground/90">{post.content}</div>
          </article>
        )}
      </main>
    </div>
  );
}
