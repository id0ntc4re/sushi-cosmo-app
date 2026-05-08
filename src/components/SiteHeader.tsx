import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Clock, ChevronDown, User, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import logo from "@/assets/logo.svg";

const BRANCHES = [
  { name: "Центр", address: "ул. Весенняя, 12", phone: "+7 913 286 92-84", hours: "10:00–22:00" },
  { name: "Ленинский", address: "пр. Ленина, 87", phone: "+7 913 286 92-85", hours: "10:00–23:00" },
  { name: "ФПК", address: "б-р Строителей, 32", phone: "+7 913 286 92-86", hours: "11:00–22:00" },
];

export function SiteHeader() {
  const [active, setActive] = useState(BRANCHES[0]);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b shadow-sm">
      {/* Top strip */}
      <div className="bg-foreground text-primary-foreground text-xs">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 h-8 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Доставка {active.hours}</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span>Бесплатная доставка от 1500 ₽</span>
            <span className="opacity-70">·</span>
            <span>Бонусы за каждый заказ</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 sm:px-4 h-16 md:h-20 flex items-center gap-3 md:gap-6">
        <Link to="/" className="flex items-center gap-2 md:gap-3 group min-w-0">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-muted rounded-full blur-xl group-hover:blur-2xl transition-all" />
            <img src={logo} alt="КосмоСуши" className="h-10 w-10 md:h-12 md:w-12 relative" />
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-lg md:text-xl font-bold text-foreground truncate">КосмоСуши</div>
            <div className="text-[10px] md:text-xs text-muted-foreground">г. Кемерово</div>
          </div>
        </Link>

        {/* Branch selector — desktop only */}
        <div className="relative hidden xl:block">
          <button
            onClick={() => setOpen((v) => !v)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:border-primary hover:bg-muted transition-all"
          >
            <MapPin className="h-4 w-4 text-primary" />
            <div className="text-left leading-tight">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Филиал</div>
              <div className="text-sm font-semibold">{active.name}</div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-popover border rounded-xl shadow-xl overflow-hidden z-50">
              {BRANCHES.map((b) => (
                <button
                  key={b.name}
                  onMouseDown={() => { setActive(b); setOpen(false); }}
                  className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0 ${active.name === b.name ? "bg-accent/50" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.address}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.hours}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="ml-auto hidden md:flex items-center gap-4 lg:gap-5 text-sm font-medium">
          <Link to="/" hash="menu" className="hover:text-primary transition-colors whitespace-nowrap">Меню</Link>
          <Link to="/news" className="hover:text-primary transition-colors whitespace-nowrap">Акции</Link>
          <Link to="/about" className="hover:text-primary transition-colors whitespace-nowrap">О компании</Link>
          <Link to="/delivery" className="hover:text-primary transition-colors whitespace-nowrap">Доставка</Link>
          <Link to="/faq" className="hover:text-primary transition-colors whitespace-nowrap">Вопросы</Link>
          <Link
            to="/account-login"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-primary-foreground transition-all whitespace-nowrap"
          >
            <User className="h-4 w-4" />
            <span className="hidden lg:inline">Личный кабинет</span>
          </Link>
          <a
            href={`tel:${active.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-lg hover:shadow-primary/30 transition-all whitespace-nowrap"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden lg:inline">{active.phone}</span>
          </a>
        </nav>

        {/* Mobile actions */}
        <div className="ml-auto flex md:hidden items-center gap-1">
          <a
            href={`tel:${active.phone.replace(/\s/g, "")}`}
            className="h-10 w-10 grid place-items-center rounded-full bg-primary text-primary-foreground"
            aria-label="Позвонить"
          >
            <Phone className="h-4 w-4" />
          </a>
          <button
            onClick={() => setMobileOpen(true)}
            className="h-10 w-10 grid place-items-center rounded-full border border-border"
            aria-label="Меню"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[82%] max-w-sm bg-background shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b">
              <div className="flex items-center gap-2">
                <img src={logo} alt="" className="h-9 w-9" />
                <span className="font-extrabold">КосмоСуши</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="h-10 w-10 grid place-items-center rounded-full hover:bg-muted"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3 text-base font-semibold">
              {[
                { to: "/", hash: "menu", label: "Меню" },
                { to: "/news", label: "Акции" },
                { to: "/about", label: "О компании" },
                { to: "/delivery", label: "Доставка" },
                { to: "/faq", label: "Вопросы и ответы" },
                { to: "/account-login", label: "Личный кабинет" },
              ].map((l) => (
                <Link
                  key={l.label}
                  to={l.to as any}
                  hash={l.hash}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-xl hover:bg-muted active:bg-muted"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-4 px-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Филиалы</div>
                <div className="space-y-2">
                  {BRANCHES.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => { setActive(b); }}
                      className={`w-full text-left p-3 rounded-xl border ${active.name === b.name ? "border-primary bg-muted" : "border-border"}`}
                    >
                      <div className="font-bold text-sm">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.address}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{b.phone} · {b.hours}</div>
                    </button>
                  ))}
                </div>
              </div>
            </nav>
            <a
              href={`tel:${active.phone.replace(/\s/g, "")}`}
              className="m-3 py-3 text-center rounded-full bg-primary text-primary-foreground font-bold"
            >
              📞 {active.phone}
            </a>
          </aside>
        </div>
      )}
    </header>
  );
}
