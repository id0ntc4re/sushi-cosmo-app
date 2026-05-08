import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Вопросы и ответы — КосмоСуши" },
      { name: "description", content: "Частые вопросы о доставке, оплате, составе блюд и аллергенах в КосмоСуши." },
    ],
  }),
  component: FaqPage,
});

type Section = { title: string; items: { q: string; a: string }[] };

const SECTIONS: Section[] = [
  {
    title: "Доставка",
    items: [
      { q: "В какие районы вы доставляете?", a: "Мы доставляем по всему Кемерово. Стоимость и время зависят от удалённости — рассчитать можно в калькуляторе на странице «Доставка»." },
      { q: "Сколько занимает доставка?", a: "Среднее время — 60–90 минут. В часы пик (пт-вс, 19:00–21:00) — до 120 минут." },
      { q: "Какая минимальная сумма заказа?", a: "Минимальный заказ — 600 ₽. Бесплатная доставка от 1500 ₽ в пределах города." },
      { q: "Можно ли заказать на конкретное время?", a: "Да, при оформлении укажите желаемое время — привезём с точностью ±15 минут." },
      { q: "Работает ли самовывоз?", a: "Да, забрать заказ можно из любого нашего филиала. Самовывоз без минимальной суммы." },
    ],
  },
  {
    title: "Оплата",
    items: [
      { q: "Какие способы оплаты доступны?", a: "Наличными или картой курьеру при получении. Скоро добавим онлайн-оплату." },
      { q: "Можно ли оплатить бонусами?", a: "Да, бонусами можно оплатить до 30% от суммы заказа. Бонусы начисляются с каждого заказа в зависимости от вашего уровня." },
      { q: "Дадите ли вы сдачу?", a: "Конечно. При оформлении укажите, с какой суммы подготовить сдачу." },
      { q: "Выдаёте ли вы чек?", a: "Да, фискальный чек выдаём при получении заказа. Электронный чек доступен в личном кабинете." },
    ],
  },
  {
    title: "Состав и аллергены",
    items: [
      { q: "Где посмотреть состав блюда?", a: "Полный состав указан в карточке каждого товара. Если чего-то не хватает — позвоните нам, расскажем подробно." },
      { q: "Используете ли вы свежую рыбу?", a: "Да, мы работаем только со свежей охлаждённой рыбой от проверенных поставщиков. Замороженную не используем." },
      { q: "Есть ли блюда без рыбы / вегетарианские?", a: "Да — роллы с овощами, сыром, креветкой и курицей. Для удобства можно отфильтровать меню." },
      { q: "Содержат ли блюда аллергены?", a: "Большинство блюд содержат рыбу, морепродукты, сою, кунжут или глютен. Если у вас аллергия — обязательно сообщите оператору при заказе." },
      { q: "Острая ли еда?", a: "Уровень остроты у каждого блюда указан в описании. Соусы (васаби, имбирь, соевый) идут отдельно." },
    ],
  },
  {
    title: "Заказ и личный кабинет",
    items: [
      { q: "Как повторить прошлый заказ?", a: "Откройте «Заказы» в личном кабинете и нажмите «Повторить» — корзина соберётся автоматически." },
      { q: "Можно ли отменить заказ?", a: "Да, пока статус «Новый». В личном кабинете нажмите «Отменить» рядом с заказом." },
      { q: "Как работает программа лояльности?", a: "За каждый заказ начисляются бонусы. С ростом суммы заказов открываются уровни Bronze → Silver → Gold с увеличенным кешбэком." },
    ],
  },
];

function FaqPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <SiteHeader />
      <main>
        <div className="mx-auto max-w-[1280px] px-6 py-10 md:py-14">
          <div className="mb-8">
            <Link to="/" className="text-sm text-neutral-500 hover:text-primary">← На главную</Link>
            <h1 className="mt-3 text-4xl md:text-5xl font-extrabold">Вопросы и ответы</h1>
            <p className="mt-3 text-neutral-600 max-w-2xl">Собрали всё самое частое — про доставку, оплату, состав блюд и работу личного кабинета. Не нашли ответ? Позвоните: <a href="tel:+79132869284" className="text-primary font-semibold">+7 913 286 92-84</a>.</p>
          </div>

          <div className="space-y-8">
            {SECTIONS.map((s) => (
              <section key={s.title} className="bg-white rounded-3xl p-6 md:p-8">
                <h2 className="text-2xl font-extrabold mb-4">{s.title}</h2>
                <div className="divide-y">
                  {s.items.map((it, i) => (
                    <FaqItem key={i} q={it.q} a={it.a} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-start gap-3 text-left">
        <span className="flex-1 font-semibold text-neutral-900">{q}</span>
        <ChevronDown className={`h-5 w-5 mt-0.5 text-neutral-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="mt-2 text-neutral-600 text-sm leading-relaxed pr-8">{a}</p>}
    </div>
  );
}
