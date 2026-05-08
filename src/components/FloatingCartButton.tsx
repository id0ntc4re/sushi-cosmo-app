import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

export function FloatingCartButton() {
  const { count, subtotal, setOpen } = useCart();

  if (count === 0) return null;

  return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-40 group flex items-center gap-3 pl-4 pr-5 py-3 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all"
      aria-label="Открыть корзину"
    >
      <div className="relative">
        <ShoppingCart className="h-6 w-6" />
        <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-background text-foreground text-[11px] font-bold flex items-center justify-center border-2 border-primary">
          {count}
        </span>
      </div>
      <span className="font-bold text-sm whitespace-nowrap">
        {Math.round(subtotal)} ₽
      </span>
      <span className="absolute inset-0 rounded-full bg-primary/40 -z-10 animate-ping opacity-30" />
    </button>
  );
}
