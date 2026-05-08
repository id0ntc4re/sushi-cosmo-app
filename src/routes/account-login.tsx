import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/account-login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({ meta: [{ title: "Вход в личный кабинет — КосмоСуши" }] }),
  component: AccountLogin,
});

function AccountLogin() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Вы вошли в личный кабинет");
        nav({ to: redirect || "/account" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/account` },
        });
        if (error) throw error;
        toast.success("Аккаунт создан", { description: "Если потребуется, подтвердите почту и войдите снова" });
        nav({ to: redirect || "/account" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <SiteHeader />
    <div className="min-h-[calc(100vh-7rem)] grid place-items-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <img src={logo} className="h-10 w-10" alt="" />
          <span className="font-extrabold text-xl">КосмоСуши</span>
        </Link>
        <h1 className="text-2xl font-extrabold text-center mb-1">
          {mode === "login" ? "Вход в личный кабинет" : "Регистрация клиента"}
        </h1>
        <p className="text-center text-neutral-500 text-sm mb-6">
          История заказов и быстрый повтор покупки
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? "Войти в ЛК" : "Создать аккаунт"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="block w-full text-center mt-4 text-sm text-neutral-500 hover:text-primary"
        >
          {mode === "login" ? "Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}