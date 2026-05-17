import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/order-success")({
  validateSearch: z.object({ n: z.coerce.number().optional() }),
  head: () => ({ meta: [{ title: "Заказ принят — КосмоСуши" }] }),
  component: Success,
});

function Success() {
  const { n } = Route.useSearch();
  return (
    <div className="min-h-screen grid place-items-center bg-neutral-50 px-4">
      <div className="bg-white rounded-3xl p-10 max-w-md text-center shadow-sm">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-extrabold mb-2">Заказ принят!</h1>
        {n && <p className="text-neutral-600 mb-2">Номер заказа <span className="font-bold">#{n}</span></p>}
        <p className="text-neutral-700 mb-2 font-semibold">
          Администратор свяжется с вами в ближайшее время для подтверждения заказа.
        </p>
        <p className="text-sm text-neutral-500 mb-6">
          Пожалуйста, держите телефон под рукой.
        </p>
        <Link to="/" className="inline-block px-8 py-3 rounded-full bg-primary text-white font-bold hover:opacity-90">
          Вернуться в меню
        </Link>
      </div>
    </div>
  );
}
