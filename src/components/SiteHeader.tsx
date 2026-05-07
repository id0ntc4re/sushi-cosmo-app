import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.svg";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b">
      <div className="mx-auto max-w-7xl px-4 h-20 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="КосмоСуши" className="h-12 w-12" />
          <div className="leading-tight">
            <div className="text-xl font-bold">КосмоСуши</div>
            <div className="text-xs text-muted-foreground">г. Кемерово · доставка 10:00–22:00</div>
          </div>
        </Link>
        <nav className="ml-auto hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/" className="hover:text-primary">Меню</Link>
          <a href="#contacts" className="hover:text-primary">Контакты</a>
          <a href="tel:+79132869284" className="text-primary font-bold">+7 913 286 92-84</a>
        </nav>
      </div>
    </header>
  );
}
