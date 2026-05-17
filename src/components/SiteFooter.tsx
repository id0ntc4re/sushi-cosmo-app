import logo from "@/assets/logo.svg";

export function SiteFooter() {
  return (
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
            <li className="flex items-start gap-2"><span className="text-primary">📍</span>пр-т Шахтёров, 68</li>
            <li className="flex items-start gap-2"><span className="text-primary">📍</span>бульвар Строителей, 21</li>
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
          <div className="mt-4 text-sm opacity-80">
            <a href="/faq" className="hover:text-primary underline-offset-4 hover:underline">Вопросы и ответы</a>
          </div>
        </div>
      </div>
      <div className="border-t border-background/10">
        <div className="mx-auto max-w-[1280px] px-6 py-4 text-xs opacity-60 text-center">
          © {new Date().getFullYear()} КосмоСуши · Все права защищены
        </div>
      </div>
    </footer>
  );
}
