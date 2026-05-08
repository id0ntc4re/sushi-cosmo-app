import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Mail, Phone, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "О компании — КосмоСуши Кемерово" },
      { name: "description", content: "КосмоСуши — ресторан быстрого обслуживания в Кемерово. Наша история, ценности и команда." },
      { property: "og:title", content: "О компании — КосмоСуши Кемерово" },
      { property: "og:description", content: "Ресторан быстрого обслуживания. Свежие ингредиенты, проверенные поставщики, красивая подача." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-6 py-14">
        <p className="text-sm text-muted-foreground mb-2">Главная — О компании</p>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-3">О компании</h1>
        <p className="text-xl text-primary font-semibold mb-8">«Cosmo Sushi» — ресторан быстрого обслуживания.</p>

        <div className="prose prose-lg max-w-none space-y-5 text-foreground/90">
          <p>
            Мы знаем о суши всё, включая то, что обычно нравится людям, поэтому мы специально сократили меню,
            чтобы вам было проще сделать выбор. Всё, что вы выберете — вам понравится.
          </p>
          <p>
            Мы готовим суши и для себя в том числе, поэтому мы сотрудничаем с надёжными поставщиками,
            тщательно следим за составом и свежестью ингредиентов, чтобы всегда гарантировать качество еды,
            которую мы едим.
          </p>
          <p>
            Еда должна быть не только вкусной, но и красивой. Поэтому мы уделяем большое внимание сервировке блюд,
            тому, в каком виде она попадёт на ваш стол.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-10">
          <div className="rounded-2xl border bg-card p-6">
            <div className="h-11 w-11 rounded-xl bg-muted grid place-items-center mb-3">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="font-bold mb-1">Вопросы и предложения</div>
            <p className="text-sm text-muted-foreground mb-2">Оставляйте предложения, пожелания и замечания на нашу почту.</p>
            <a href="mailto:info@cosmosushi.ru" className="text-primary font-semibold">info@cosmosushi.ru</a>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <div className="h-11 w-11 rounded-xl bg-muted grid place-items-center mb-3">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="font-bold mb-1">Работай с нами</div>
            <p className="text-sm text-muted-foreground mb-2">Профессионал своего дела и хочешь работать в сильной команде?</p>
            <a href="tel:+79132869284" className="inline-flex items-center gap-2 text-primary font-semibold">
              <Phone className="h-4 w-4" /> 8 913 286-92-84
            </a>
          </div>
        </div>

        <div className="mt-10 p-6 rounded-2xl bg-muted flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm">Для нас важно ваше мнение — оно помогает становиться лучше каждый день.</p>
        </div>
      </main>
    </div>
  );
}
