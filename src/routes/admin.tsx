import { createFileRoute, Outlet, Link, useRouterState, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminNotifications } from "@/lib/admin-notifications";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Админ — КосмоСуши" }] }),
  component: AdminLayout,
});

const NAV: { to: string; label: string; icon: string; exact?: boolean; superOnly?: boolean }[] = [
  { to: "/admin", label: "Дашборд", icon: "📊", exact: true },
  { to: "/admin/kanban", label: "Канбан заказов", icon: "🟢" },
  { to: "/admin/pos", label: "📞 Принять заказ", icon: "➕" },
  { to: "/admin/orders", label: "Заказы", icon: "📦" },
  { to: "/admin/callbacks", label: "Заявки на звонок", icon: "📞" },
  { to: "/admin/customers", label: "Клиенты", icon: "👥" },
  { to: "/admin/reports", label: "Отчёты", icon: "📈" },
  { to: "/admin/shifts", label: "Кассовые смены", icon: "💵" },
  { to: "/admin/warehouse", label: "Склад по филиалам", icon: "🏬" },
  { to: "/admin/expenses", label: "Прочие расходы", icon: "💸" },
  { to: "/admin/inventory", label: "Ингредиенты / Техкарты", icon: "📦" },
  { to: "/admin/modifiers", label: "Модификаторы", icon: "🧩", superOnly: true },
  { to: "/admin/trash", label: "Удалённые заказы", icon: "🗑️" },
  { to: "/admin/branches", label: "Филиалы", icon: "🏢", superOnly: true },
  { to: "/admin/couriers", label: "Курьеры и зоны", icon: "🛵", superOnly: true },
  { to: "/admin/products", label: "Товары", icon: "🍣", superOnly: true },
  { to: "/admin/categories", label: "Категории", icon: "🗂️", superOnly: true },
  { to: "/admin/banners", label: "Баннеры", icon: "🖼️", superOnly: true },
  { to: "/admin/news", label: "Акции и новости", icon: "📰", superOnly: true },
  { to: "/admin/promos", label: "Промокоды", icon: "🏷️", superOnly: true },
  { to: "/admin/settings", label: "Настройки", icon: "⚙️", superOnly: true },
];

function AdminLayout() {
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<"loading" | "ok" | "no-auth" | "no-admin">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setState("no-auth");
        return;
      }
      setEmail(user.email ?? null);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role,branch_id")
        .eq("user_id", user.id);
      const rs = (roles ?? []) as { role: string; branch_id: string | null }[];
      const sup = rs.some((r) => r.role === "super_admin");
      const adminRow = rs.find((r) => r.role === "admin");
      const ok = sup || !!adminRow;
      if (!mounted) return;
      setIsSuper(sup);
      if (adminRow?.branch_id) {
        setBranchId(adminRow.branch_id);
        const { data: b } = await supabase.from("branches").select("name").eq("id", adminRow.branch_id).maybeSingle();
        if (mounted) setBranchName(b?.name ?? null);
      }
      setState(ok ? "ok" : "no-admin");
    })();
    return () => { mounted = false; };
  }, []);

  if (state === "loading") {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Загрузка…</div>;
  }
  if (state === "no-auth") {
    throw redirect({ to: "/login", search: { redirect: "/admin" } });
  }
  if (state === "no-admin") {
    return (
      <div className="min-h-screen grid place-items-center bg-neutral-50 px-4">
        <div className="bg-white rounded-3xl p-8 max-w-md text-center shadow-sm">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-2xl font-extrabold mb-2">Нет доступа</h1>
          <p className="text-neutral-500 mb-5 text-sm">
            Аккаунт <b>{email}</b> не имеет роли администратора.<br />
            Назначьте роль <code className="bg-neutral-100 px-1.5 py-0.5 rounded">admin</code> в таблице <code className="bg-neutral-100 px-1.5 py-0.5 rounded">user_roles</code>.
          </p>
          <button
            onClick={async () => { await supabase.auth.signOut(); nav({ to: "/login" }); }}
            className="px-6 py-2.5 rounded-full bg-neutral-900 text-white font-semibold"
          >
            Сменить аккаунт
          </button>
        </div>
      </div>
    );
  }

  return <AdminShell email={email} isSuper={isSuper} branchId={branchId} branchName={branchName} path={path} nav={nav} />;
}

function AdminShell({
  email, isSuper, branchId, branchName, path, nav,
}: { email: string | null; isSuper: boolean; branchId: string | null; branchName: string | null; path: string; nav: ReturnType<typeof useNavigate> }) {
  useAdminNotifications({ isSuper, branchId });
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);

  const sidebar = (
    <>
      <Link to="/admin" className="flex items-center gap-2 p-5 border-b">
        <img src={logo} className="h-9 w-9" alt="" />
        <div>
          <div className="font-extrabold leading-tight">КосмоСуши</div>
          <div className="text-xs text-neutral-500">
            {isSuper ? "👑 Главный админ" : branchName ? `Филиал · ${branchName}` : "Админ-панель"}
          </div>
        </div>
      </Link>
      <nav className="p-3 flex-1 space-y-1 overflow-y-auto">
        {NAV.filter((n) => !n.superOnly || isSuper).map((n) => {
          const active = n.exact ? path === n.to : path.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to}
              className={`flex items-center gap-3 px-3 min-h-11 py-3 rounded-xl text-[15px] lg:text-sm font-semibold transition ${
                active ? "bg-primary text-white" : "text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200"
              }`}>
              <span className="text-lg">{n.icon}</span>{n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t space-y-2">
        <Link to="/" className="block text-xs text-neutral-500 hover:text-primary px-3">← На сайт</Link>
        <div className="text-xs text-neutral-500 px-3 truncate">{email}</div>
        <button
          onClick={async () => { await supabase.auth.signOut(); nav({ to: "/login" }); }}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Выйти
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen lg:flex bg-neutral-50">
      {/* Mobile topbar */}
      <div className="lg:hidden sticky top-0 z-30 bg-white border-b flex items-center gap-3 px-3 h-16">
        <button onClick={() => setOpen(true)} className="h-12 w-12 grid place-items-center rounded-xl hover:bg-neutral-100 active:bg-neutral-200" aria-label="Меню">
          <span className="text-2xl">☰</span>
        </button>
        <Link to="/admin" className="flex items-center gap-2 min-w-0">
          <img src={logo} className="h-7 w-7 shrink-0" alt="" />
          <span className="font-extrabold truncate">{isSuper ? "Главный админ" : branchName ?? "Админ"}</span>
        </Link>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r flex-col shrink-0">{sidebar}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[82%] max-w-xs bg-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-end p-2 border-b">
              <button onClick={() => setOpen(false)} className="h-12 w-12 grid place-items-center rounded-xl hover:bg-neutral-100 active:bg-neutral-200" aria-label="Закрыть">
                <span className="text-2xl">×</span>
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
