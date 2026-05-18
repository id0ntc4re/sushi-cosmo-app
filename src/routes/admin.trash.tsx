import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminRole, branchName } from "@/lib/admin-role";

export const Route = createFileRoute("/admin/trash")({ component: TrashPage });

const STATUS_LABEL: Record<string, string> = {
  new: "Новый", confirmed: "Подтверждён", cooking: "Готовится",
  delivering: "Доставка", done: "Выполнен", cancelled: "Отменён",
};

function TrashPage() {
  const { isSuper, branches } = useAdminRole();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("orders")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(200);
    setOrders(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function restore(id: string) {
    const { error } = await supabase.from("orders").update({ deleted_at: null } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Заказ восстановлен");
    load();
  }

  async function purge(id: string) {
    if (!confirm("Удалить заказ НАВСЕГДА? Это действие необратимо.")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалено навсегда");
    load();
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-2">🗑️ Удалённые заказы</h1>
      <p className="text-sm text-neutral-500 mb-6">Заказы, помеченные как удалённые. Можно восстановить или удалить окончательно.</p>

      {loading ? (
        <div className="text-neutral-400 text-sm">Загрузка…</div>
      ) : (
        <div className="bg-white rounded-3xl overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="p-3">№</th>
                <th>Клиент</th>
                <th>Телефон</th>
                {isSuper && <th>Филиал</th>}
                <th>Сумма</th>
                <th>Статус</th>
                <th>Удалён</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-3 font-bold">#{o.number}</td>
                  <td>{o.customer_name}</td>
                  <td className="text-neutral-600">{o.phone}</td>
                  {isSuper && <td className="text-xs text-neutral-500">{branchName(branches, o.branch_id)}</td>}
                  <td className="font-bold">{Number(o.total)} ₽</td>
                  <td className="text-xs text-neutral-500">{STATUS_LABEL[o.status] ?? o.status}</td>
                  <td className="text-xs text-neutral-500">{new Date(o.deleted_at).toLocaleString("ru")}</td>
                  <td className="text-right pr-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => restore(o.id)}
                        className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100">
                        ↩ Восстановить
                      </button>
                      <button onClick={() => purge(o.id)}
                        className="px-3 py-1.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100">
                        Удалить навсегда
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!orders.length && (
                <tr><td colSpan={isSuper ? 8 : 7} className="py-10 text-center text-neutral-400">Корзина пуста</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
