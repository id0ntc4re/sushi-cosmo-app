import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({ meta: [{ title: "Вход — КосмоСуши" }] }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Добро пожаловать");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Аккаунт создан");
      }
      nav({ to: redirect || "/admin" });
    } catch (err: any) {
      toast.error(err.message ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-50 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-sm">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <img src={logo} className="h-10 w-10" alt="" />
          <span className="font-extrabold text-xl">КосмоСуши</span>
        </Link>
        <h1 className="text-2xl font-extrabold text-center mb-1">
          {mode === "login" ? "Вход" : "Регистрация"}
        </h1>
        <p className="text-center text-neutral-500 text-sm mb-6">
          Доступ к админ-панели
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
            {loading ? "..." : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="block w-full text-center mt-4 text-sm text-neutral-500 hover:text-primary"
        >
          {mode === "login" ? "Создать аккаунт" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}
