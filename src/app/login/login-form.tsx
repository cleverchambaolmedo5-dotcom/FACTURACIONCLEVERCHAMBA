"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";

// `module`: the key of the module the user clicked on "/" (see
// src/config/modules.ts), forwarded as-is from the page's `?module=`
// query param. Submitted as a hidden field so the login() Server Action
// knows where to redirect on success -- see src/lib/auth/actions.ts.
export function LoginForm({ module }: { module?: string }) {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {module && <input type="hidden" name="module" value={module} />}
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-[#1e293b]">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[#1e293b] outline-none transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-[#1e293b]">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-[#1e293b] outline-none transition-colors duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-error">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-lg disabled:pointer-events-none disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {pending ? "Iniciando sesión…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
