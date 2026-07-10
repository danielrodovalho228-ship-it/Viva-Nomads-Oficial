"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Search, X } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { setPreferredMode } from "@/lib/data/mode-actions";

const ASKED_KEY = "vivanomads-role-asked";

/**
 * Pergunta de PAPEL no primeiro login (uma vez só). Define o papel inicial —
 * o toggle continua permitindo trocar depois. Não reaparece nas próximas
 * sessões (marca em localStorage). Só aparece para usuário REAL logado.
 */
export function RoleWelcomeModal() {
  const user = useAuthStore((s) => s.user);
  const setActiveMode = useAuthStore((s) => s.setActiveMode);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return; // só usuário real logado
    try {
      if (localStorage.getItem(ASKED_KEY)) return;
    } catch {
      return;
    }
    setOpen(true);
  }, [user]);

  function done() {
    try {
      localStorage.setItem(ASKED_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function pick(mode: "tenant" | "owner") {
    setActiveMode(mode);
    // Conta nova grava o modo no perfil já no primeiro acesso (B1).
    setPreferredMode(mode).catch(() => {});
    done();
    if (mode === "owner") router.push("/qualificar");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-night/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-welcome-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id="role-welcome-title" className="font-title text-2xl font-bold text-ink">
            Bem-vindo ao Viva Nomads!
          </h2>
          <button
            onClick={done}
            aria-label="Fechar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-muted">O que você veio fazer?</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => pick("tenant")}
            className="group rounded-2xl border border-sage-200 p-5 text-left transition-colors hover:border-forest hover:bg-blue-50"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
              <Search className="h-5 w-5" />
            </span>
            <span className="mt-4 block font-title text-lg font-bold text-ink">
              Buscar um lugar para morar
            </span>
            <span className="mt-1 block text-sm text-muted">
              Encontre imóveis mobiliados ou publique um pedido e receba respostas.
            </span>
          </button>

          <button
            onClick={() => pick("owner")}
            className="group rounded-2xl border border-sage-200 p-5 text-left transition-colors hover:border-forest hover:bg-blue-50"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-champagne text-forest">
              <Home className="h-5 w-5" />
            </span>
            <span className="mt-4 block font-title text-lg font-bold text-ink">
              Anunciar meu imóvel
            </span>
            <span className="mt-1 block text-sm text-muted">
              Qualifique seu imóvel e receba inquilinos verificados.
            </span>
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-muted">
          Você pode trocar de papel quando quiser pelo seletor no topo.
        </p>
      </div>
    </div>
  );
}
