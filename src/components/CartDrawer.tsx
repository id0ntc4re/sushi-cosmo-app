import { Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";

export function CartDrawer() {
  const { items, open, setOpen, setQty, remove, subtotal } = useCart();

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-xl font-extrabold">Корзина</h3>
          <button
            onClick={() => setOpen(false)}
            className="h-9 w-9 rounded-full hover:bg-neutral-100 grid place-items-center text-2xl"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {items.length === 0 && (
            <div className="py-20 text-center text-neutral-500">
              Корзина пуста
            </div>
          )}
          {items.map((it) => (
            <div key={it.id} className="flex gap-3 items-center bg-neutral-50 rounded-2xl p-3">
              <div className="h-16 w-16 rounded-xl bg-white grid place-items-center overflow-hidden text-2xl shrink-0">
                {it.image_url ? (
                  <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
                ) : (
                  "🍣"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm line-clamp-2">{it.name}</div>
                <div className="text-xs text-neutral-500">{Number(it.price)} ₽</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQty(it.id, it.quantity - 1)}
                  className="h-7 w-7 rounded-full bg-white border hover:bg-neutral-100"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold">{it.quantity}</span>
                <button
                  onClick={() => setQty(it.id, it.quantity + 1)}
                  className="h-7 w-7 rounded-full bg-white border hover:bg-neutral-100"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => remove(it.id)}
                className="text-neutral-400 hover:text-red-500 text-xl px-1"
                aria-label="Удалить"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="border-t p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-neutral-600">Сумма</span>
              <span className="text-2xl font-extrabold">{subtotal} ₽</span>
            </div>
            <Link
              to="/checkout"
              onClick={() => setOpen(false)}
              className="block text-center w-full py-3.5 rounded-full bg-primary text-white font-bold hover:opacity-90"
            >
              Оформить заказ
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
