const TOKEN_KEY = "unicred_admin_token";

export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_UNICRED_API_URL || "";
  return `${base}${path}`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Modo privado / storage bloqueado: la sesión simplemente no sobrevive un refresh.
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // no-op
  }
}

export type LoginUser = { id: string; email: string; name: string; status: string; role: string };
export type LoginResult = { token: string; user: LoginUser };

/** Mismo endpoint que usa la app móvil (lib/mobile/ops.ts → mobileLogin en el repo unicred). */
export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "No se pudo iniciar sesión");
  }
  return data as LoginResult;
}
