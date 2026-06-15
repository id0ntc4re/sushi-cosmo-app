import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminRole, type Branch } from "@/lib/admin-role";
import { sendTestBranchEmail } from "@/lib/branch-email.functions";

export const Route = createFileRoute("/admin/branches")({ component: BranchesPage });

type RoleRow = { id: string; user_id: string; role: string; branch_id: string | null; email?: string | null };

function BranchesPage() {
  const { isSuper, loading } = useAdminRole();
  const [list, setList] = useState<Branch[]>([]);
  const [editing, setEditing] = useState<Partial<Branch> | null>(null);
  const [admins, setAdmins] = useState<RoleRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBranch, setInviteBranch] = useState<string>("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const sendTest = useServerFn(sendTestBranchEmail);

  async function testEmail(b: Branch) {
    if (!b.email) return toast.error("Сначала укажите email для филиала");
    setTestingId(b.id);
    try {
      const res = await sendTest({ data: { branchId: b.id } });
      toast.success(`Письмо отправлено на ${res.sentTo}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось отправить");
    } finally {
      setTestingId(null);
    }
  }

  async function load() {
    // Полный набор колонок (включая kkt_*, email) приходит только через SECURITY DEFINER RPC
    const { data } = await (supabase.rpc as any)("list_branches_full");
    setList((data ?? []) as Branch[]);


    const { data: roles } = await supabase
      .from("user_roles")
      .select("id,user_id,role,branch_id")
      .in("role", ["admin", "super_admin"]);
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    let map: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,email").in("id", ids);
      map = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.email]));
    }
    setAdmins(((roles ?? []) as any[]).map((r) => ({ ...r, email: map[r.user_id] ?? r.user_id.slice(0, 8) })));
  }

  useEffect(() => { if (isSuper) load(); }, [isSuper]);

  async function save() {
    if (!editing) return;
    const e: any = editing;
    const payload: any = {
      name: editing.name?.trim(),
      address: editing.address ?? null,
      phone: editing.phone ?? null,
      email: editing.email?.trim() || null,
      is_active: editing.is_active ?? true,
      sort_order: editing.sort_order ?? 0,
      kkt_url: e.kkt_url?.trim() || null,
      kkt_tax_system: e.kkt_tax_system || "usn_income",
      kkt_vat: e.kkt_vat || "none",
      kkt_operator_name: e.kkt_operator_name?.trim() || "Кассир",
      kkt_operator_inn: e.kkt_operator_inn?.trim() || null,
      kkt_model: e.kkt_model?.trim() || null,
      kkt_payments_place: e.kkt_payments_place?.trim() || null,
      kkt_payments_address: e.kkt_payments_address?.trim() || null,
    };
    if (!payload.name) return toast.error("Введите название");
    const { error } = editing.id
      ? await (supabase.from("branches") as any).update(payload).eq("id", editing.id)
      : await (supabase.from("branches") as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    setEditing(null); load();
  }

  async function remove(id: string) {
    if (!confirm("Удалить филиал? Заказы и смены потеряют привязку.")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  async function assignAdmin() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !inviteBranch) return toast.error("Email и филиал обязательны");
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!prof) return toast.error("Пользователь не найден. Сначала он должен зарегистрироваться на сайте.");
    const { error } = await supabase.from("user_roles").insert({ user_id: prof.id, role: "admin", branch_id: inviteBranch });
    if (error) return toast.error(error.message);
    toast.success("Администратор назначен");
    setInviteEmail(""); load();
  }

  async function removeRole(id: string) {
    if (!confirm("Удалить роль?")) return;
    await supabase.from("user_roles").delete().eq("id", id);
    load();
  }

  if (loading) return <div className="text-neutral-500">Загрузка…</div>;
  if (!isSuper) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="text-2xl font-extrabold mb-2">Только для главного администратора</h1>
        <p className="text-neutral-500">Эта страница доступна только владельцу сети.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl sm:text-3xl font-extrabold">Филиалы</h1>
        <button onClick={() => setEditing({ is_active: true, sort_order: list.length })}
          className="h-9 px-3 text-sm rounded-full bg-primary text-white font-semibold whitespace-nowrap">+ Добавить</button>
      </div>

      <div className="bg-white rounded-3xl overflow-x-auto mb-8">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr><th className="p-3">Название</th><th>Адрес</th><th>Телефон</th><th>Статус</th><th>Заказы / Касса</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3 font-bold">{b.name}</td>
                <td>{b.address || "—"}</td>
                <td>{b.phone || "—"}</td>
                <td>{b.is_active
                  ? <span className="text-green-600 font-semibold">Активен</span>
                  : <span className="text-neutral-400">Выключен</span>}</td>
                <td><BranchStats branchId={b.id} /></td>
                <td className="text-right pr-3 whitespace-nowrap">
                  <button onClick={() => testEmail(b)} disabled={testingId === b.id}
                    title="Отправить тестовое письмо на email филиала"
                    className="text-xs px-2 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 font-semibold mr-2 disabled:opacity-50">
                    {testingId === b.id ? "…" : "✉️ Тест"}
                  </button>
                  <button onClick={() => setEditing(b)} className="text-primary font-semibold mr-3">✏️</button>
                  <button onClick={() => remove(b.id)} className="text-red-500">🗑️</button>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="py-10 text-center text-neutral-400">Нет филиалов</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-3xl p-6">
        <h2 className="text-xl font-extrabold mb-4">Администраторы филиалов</h2>
        <div className="flex flex-wrap gap-2 mb-5 items-end">
          <label className="flex-1 min-w-[200px]">
            <span className="text-sm text-neutral-600 block mb-1">Email пользователя</span>
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@email.com" className="w-full px-3 py-2 rounded-xl border" />
          </label>
          <label className="min-w-[200px]">
            <span className="text-sm text-neutral-600 block mb-1">Филиал</span>
            <select value={inviteBranch} onChange={(e) => setInviteBranch(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-white">
              <option value="">— выбрать —</option>
              {list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <button onClick={assignAdmin} className="px-5 py-2.5 rounded-full bg-neutral-900 text-white font-bold">Назначить</button>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500 border-b">
            <tr><th className="py-2">Email</th><th>Роль</th><th>Филиал</th><th></th></tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="py-3">{a.email}</td>
                <td><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${a.role === "super_admin" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                  {a.role === "super_admin" ? "Главный" : "Админ филиала"}
                </span></td>
                <td>{a.role === "super_admin" ? "— все —" : (list.find((b) => b.id === a.branch_id)?.name ?? "—")}</td>
                <td className="text-right">
                  {a.role !== "super_admin" && (
                    <button onClick={() => removeRole(a.id)} className="text-red-500 text-xs">Удалить</button>
                  )}
                </td>
              </tr>
            ))}
            {!admins.length && <tr><td colSpan={4} className="py-6 text-center text-neutral-400">Нет администраторов</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto my-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-extrabold mb-4">{editing.id ? "Изменить филиал" : "Новый филиал"}</h3>
            <div className="space-y-3">
              <Field label="Название"><input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border" /></Field>
              <Field label="Адрес"><input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border" /></Field>
              <Field label="Телефон"><input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border" /></Field>
              <Field label="Email для копий заказов">
                <input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  placeholder="orders@filial.ru" className="w-full px-3 py-2 rounded-xl border" />
                <p className="text-xs text-neutral-500 mt-1">На этот адрес автоматически уходит копия каждого нового заказа.</p>
              </Field>
              <Field label="Порядок"><input placeholder="0" type="number" value={(editing.sort_order ?? 0) || ""} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border" /></Field>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.is_active ?? true}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                <span>Активен</span>
              </label>

              <div className="pt-3 mt-2 border-t">
                <div className="text-sm font-bold mb-2">🧾 Фискальная касса (Атол)</div>
                <div className="space-y-3">
                  <Field label="Адрес драйвера ККТ v10">
                    <input
                      value={(editing as any).kkt_url ?? ""}
                      onChange={(e) => setEditing({ ...editing, ...({ kkt_url: e.target.value } as any) })}
                      placeholder="http://localhost:16732"
                      className="w-full px-3 py-2 rounded-xl border" />
                    <p className="text-xs text-neutral-500 mt-1">
                      Локальный HTTP-сервер драйвера ККТ на ПК кассира. Сайт должен быть открыт на том же ПК.
                    </p>
                  </Field>
                  <Field label="Модель ККТ (памятка)">
                    <input
                      value={(editing as any).kkt_model ?? ""}
                      onChange={(e) => setEditing({ ...editing, ...({ kkt_model: e.target.value } as any) })}
                      placeholder="Например: Атол 30Ф"
                      className="w-full px-3 py-2 rounded-xl border" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Система налогообложения">
                      <select
                        value={(editing as any).kkt_tax_system ?? "usn_income"}
                        onChange={(e) => setEditing({ ...editing, ...({ kkt_tax_system: e.target.value } as any) })}
                        className="w-full px-3 py-2 rounded-xl border bg-white">
                        <option value="osn">ОСН</option>
                        <option value="usn_income">УСН доход</option>
                        <option value="usn_income_outcome">УСН доход − расход</option>
                        <option value="envd">ЕНВД</option>
                        <option value="esn">ЕСН</option>
                        <option value="patent">Патент</option>
                      </select>
                    </Field>
                    <Field label="Ставка НДС">
                      <select
                        value={(editing as any).kkt_vat ?? "none"}
                        onChange={(e) => setEditing({ ...editing, ...({ kkt_vat: e.target.value } as any) })}
                        className="w-full px-3 py-2 rounded-xl border bg-white">
                        <option value="none">Без НДС</option>
                        <option value="vat0">0%</option>
                        <option value="vat10">10%</option>
                        <option value="vat20">20%</option>
                        <option value="vat110">10/110</option>
                        <option value="vat120">20/120</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="ФИО кассира">
                      <input
                        value={(editing as any).kkt_operator_name ?? ""}
                        onChange={(e) => setEditing({ ...editing, ...({ kkt_operator_name: e.target.value } as any) })}
                        placeholder="Иванов И.И."
                        className="w-full px-3 py-2 rounded-xl border" />
                    </Field>
                    <Field label="ИНН кассира (необязательно)">
                      <input
                        value={(editing as any).kkt_operator_inn ?? ""}
                        onChange={(e) => setEditing({ ...editing, ...({ kkt_operator_inn: e.target.value } as any) })}
                        placeholder="123456789012"
                        className="w-full px-3 py-2 rounded-xl border" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <Field label="Место расчётов (печатается в чеке)">
                      <input
                        value={(editing as any).kkt_payments_place ?? ""}
                        onChange={(e) => setEditing({ ...editing, ...({ kkt_payments_place: e.target.value } as any) })}
                        placeholder={`Доставка "Космо Суши"`}
                        className="w-full px-3 py-2 rounded-xl border" />
                    </Field>
                    <Field label="Адрес расчётов (печатается в чеке)">
                      <input
                        value={(editing as any).kkt_payments_address ?? ""}
                        onChange={(e) => setEditing({ ...editing, ...({ kkt_payments_address: e.target.value } as any) })}
                        placeholder="650061, г. Кемерово, пр-кт Шахтёров, д. 68"
                        className="w-full px-3 py-2 rounded-xl border" />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-full bg-neutral-100 font-semibold">Отмена</button>
              <button onClick={save} className="px-5 py-2 rounded-full bg-primary text-white font-bold">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm text-neutral-600 block mb-1">{label}</span>{children}</label>;
}

function BranchStats({ branchId }: { branchId: string }) {
  const [s, setS] = useState<{ orders: number; shifts: number } | null>(null);
  useEffect(() => {
    (async () => {
      const [{ count: o }, { count: sh }] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("branch_id", branchId).is("deleted_at", null),
        supabase.from("cash_shifts").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
      ]);
      setS({ orders: o ?? 0, shifts: sh ?? 0 });
    })();
  }, [branchId]);
  return <span className="text-xs text-neutral-500">{s ? `${s.orders} зак. / ${s.shifts} смен` : "…"}</span>;
}
