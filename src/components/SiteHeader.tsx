import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Clock, ChevronDown, User } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.svg";

const BRANCHES = [
  { name: "Центр", address: "ул. Весенняя, 12", phone: "+7 913 286 92-84", hours: "10:00–22:00" },
  { name: "Ленинский", address: "пр. Ленина, 87", phone: "+7 913 286 92-85", hours: "10:00–23:00" },
  { name: "ФПК", address: "б-р Строителей, 32", phone: "+7 913 286 92-86", hours: "11:00–22:00" },
];

export function SiteHeader() {
  const [active, setActive] = useState(BRANCHES[0]);
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b shadow-sm">
      {/* Top strip */}
      <div className="bg-foreground text-primary-foreground text-xs">
        <div className="mx-auto max-w-7xl px-4 h-8 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Доставка ежедневно {active.hours}</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span>Бесплатная доставка от 1500 ₽</span>
            <span className="opacity-70">·</span>
            <span>Бонусы за каждый заказ</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 h-20 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-muted rounded-full blur-xl group-hover:blur-2xl transition-all" />
            <img src={logo} alt="КосмоСуши" className="h-12 w-12 relative" />
          </div>
          <div className="leading-tight">
            <div className="text-xl font-bold text-foreground">
              КосмоСуши
            </div>
            <div className="text-xs text-muted-foreground">г. Кемерово</div>
          </div>
        </Link>

        {/* Branch selector */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setOpen((v) => !v)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:border-primary hover:bg-muted transition-all"
          >
            <MapPin className="h-4 w-4 text-primary" />
            <div className="text-left leading-tight">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Филиал</div>
              <div className="text-sm font-semibold">{active.name} · {active.address}</div>
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

        <nav className="ml-auto hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/" className="hover:text-primary transition-colors">Меню</Link>
          <Link to="/news" className="hover:text-primary transition-colors">Акции и новости</Link>
          <Link to="/about" className="hover:text-primary transition-colors">О компании</Link>
          <Link to="/delivery" className="hover:text-primary transition-colors">Доставка и оплата</Link>
          <a
            href={`tel:${active.phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-lg hover:shadow-primary/30 transition-all"
          >
            <Phone className="h-4 w-4" />
            {active.phone}
          </a>
        </nav>
      </div>
    </header>
  );
}
