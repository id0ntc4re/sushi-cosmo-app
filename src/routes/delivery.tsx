import { SiteFooter } from "@/components/SiteFooter";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Truck, Clock, MapPin, CreditCard, Banknote, Phone } from "lucide-react";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Доставка и оплата — КосмоСуши Кемерово" },
      { name: "description", content: "Стоимость и зоны доставки по Кемерово, время работы и способы оплаты." },
      { property: "og:title", content: "Доставка и оплата — КосмоСуши" },
      { property: "og:description", content: "Доставка ежедневно с 10:00 до 22:00, оплата наличными или картой курьеру." },
    ],
  }),
  component: DeliveryPage,
});

const ZONES = [
  { area: "Рудничный район, Ленинский район", price: 500 },
  { area: "Центр города, Кировский район, ФПК, Металлплощадка, Сухово", price: 700 },
  { area: "Лесная Поляна, Андреевка, Журавлёвы горы, д. Солнечная, ш. Бутовская, пос. Боровой, Южный, Аэропорт", price: 1000 },
  { area: "Кедровка, Промышленновский, Завокзальная часть, пос. Новостройка", price: 1300 },
  { area: "Д. Журавлёво, пос. Пионер, мкр. Ягуновский, д. Пугачи, с. Берёзово", price: 1800 },
  { area: "С. Мазурово, пос. Ясногорский, д. Мозжуха, с. Верхотомское", price: 2000 },
  { area: "Берёзовский", price: 2500 },
];

function DeliveryPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-6 py-14">
        <p className="text-sm text-muted-foreground mb-2">Главная — Доставка и оплата</p>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-8">Доставка и оплата</h1>

        <div className="grid sm:grid-cols-3 gap-3 mb-10">
          <Highlight Icon={Clock} title="10:00–22:00" text="Доставка ежедневно" />
          <Highlight Icon={Truck} title="от 500 ₽" text="Минимальная сумма заказа" />
          <Highlight Icon={MapPin} title="2 точки" text="Самовывоз в Кемерово" />
        </div>

        <Section title="Стоимость доставки по районам">
          <div className="overflow-hidden rounded-2xl border bg-card">
            {ZONES.map((z, i) => (
              <div key={i} className={`flex items-start justify-between gap-4 px-5 py-4 ${i ? "border-t" : ""}`}>
                <div className="text-sm">{z.area}</div>
                <div className="font-bold whitespace-nowrap text-primary">{z.price} ₽</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Условия и стоимость доставки в более отдалённые районы и за пределы города уточняйте у оператора.
          </p>
        </Section>

        <Section title="Время доставки">
          <ul className="space-y-2 text-foreground/90">
            <li>— Минимальное время ожидания заказа с услугой «Доставка» составляет 50 минут.</li>
            <li>— В выходные, праздничные дни, в часы пик и при большой загруженности кухни время доставки может быть увеличено.</li>
          </ul>
        </Section>

        <Section title="Самовывоз">
          <p className="mb-3">Самовывоз доступен по адресам:</p>
          <ul className="space-y-2 mb-4">
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> г. Кемерово, пр-т Шахтёров, 68</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> г. Кемерово, бульвар Строителей, 21</li>
          </ul>
          <ul className="space-y-2 text-foreground/90">
            <li>— Минимальное время приготовления блюд на самовывоз — 20–30 минут.</li>
            <li>— В часы пик и при большой загруженности кухни время может быть увеличено.</li>
          </ul>
        </Section>

        <Section title="Способы оплаты">
          <div className="grid sm:grid-cols-2 gap-3">
            <Highlight Icon={Banknote} title="Наличными" text="При получении заказа" />
            <Highlight Icon={CreditCard} title="Картой курьеру" text="Безналичная оплата" />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Способ оплаты обязательно уточняйте у оператора при оформлении заказа.
          </p>
        </Section>

        <div className="mt-10 p-6 rounded-2xl bg-muted text-center">
          <p className="mb-2">Подробности и актуальные акции уточняйте у операторов горячей линии:</p>
          <a href="tel:+79132869284" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold">
            <Phone className="h-4 w-4" /> 8 913 286-92-84
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}



function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-extrabold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Highlight({ Icon, title, text }: { Icon: any; title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center mb-2">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="font-bold">{title}</div>
      <div className="text-sm text-muted-foreground">{text}</div>
    </div>
  );
}
