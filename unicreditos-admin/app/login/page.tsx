"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getToken, login, setToken } from "@/lib/data/auth";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace("/admin");
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.user.role !== "admin") {
        throw new Error("Esta cuenta no tiene acceso al backoffice.");
      }
      setToken(result.token);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-navy">UNICRÉDITOS</h1>
        <p className="mt-1 text-sm text-slate-500">Backoffice · iniciá sesión con tu cuenta de operador.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-[13px] font-medium text-slate-700">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-[13px] font-medium text-slate-700">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {error ? <p className="mt-4 text-[13px] text-rose-600">{error}</p> : null}

        <Button type="submit" variant="navy" disabled={loading} className="mt-6 w-full">
          {loading ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </div>
  );
}
