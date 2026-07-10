"use client";

/**
 * Modo demonstração do painel — SÓ para o administrador, SÓ na interface.
 *
 * Regra crítica: este modo NUNCA grava nada no banco. Quando ligado, as telas
 * do painel passam a ler o SEED em memória (lib/demo/seed.ts) em vez das
 * consultas reais; quando desligado, voltam ao real, sem resíduo.
 *
 * O estado vive apenas na SESSÃO do navegador (sessionStorage) — fechar a aba
 * volta ao real. Também aceita ?demo=1 / ?demo=0 na URL (lido no shell).
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useAuthStore, DEMO_USER, type SessionUser } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";

/** E-mail do super admin (reforço à role 'admin' do perfil). */
export const ADMIN_EMAIL = "dtrodovalho40@gmail.com";

/** Admin = role 'admin' no perfil (preferência) OU o e-mail do super admin. */
export function isAdminUser(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin" || user.email?.toLowerCase() === ADMIN_EMAIL;
}

interface DemoState {
  on: boolean;
  setOn: (on: boolean) => void;
}

/** Estado de sessão (sessionStorage): não persiste entre abas/sessões. */
const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      on: false,
      setOn: (on) => set({ on }),
    }),
    {
      name: "vivanomads-demo",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
          : sessionStorage
      ),
    }
  )
);

/** Estado do modo demonstração + se o usuário atual pode usá-lo (admin). */
export function useDemoMode(): { admin: boolean; on: boolean; setOn: (on: boolean) => void } {
  const user = useAuthStore((s) => s.user);
  const on = useDemoStore((s) => s.on);
  const setOn = useDemoStore((s) => s.setOn);
  const admin = isAdminUser(user);
  // O modo só vale se o usuário É admin — outro usuário nunca ativa.
  return { admin, on: admin && on, setOn };
}

/**
 * Fonte de dados do painel: true = usar dados de exemplo.
 * Vale em dois casos: build de demonstração (sem Supabase) OU o modo
 * demonstração do admin ligado. A UI não muda — só a fonte.
 */
export function useDashDemo(): boolean {
  const { on } = useDemoMode();
  return !isSupabaseConfigured() || on;
}

/**
 * Usuário para EXIBIÇÃO na casca do painel (nome, avatar, plano). Devolve o
 * usuário REAL; quando não há usuário, só cai na persona de demonstração
 * (DEMO_USER — "Marcos Andrade", plano Gestor) SE o modo demo vale. É a regra da
 * FRONTEIRA DEMO/REAL aplicada à identidade: conta real com demo desligado nunca
 * vê nome, avatar ou plano fictício. Substitui os antigos `user ?? DEMO_USER`.
 */
export function useDisplayUser(): SessionUser | null {
  const user = useAuthStore((s) => s.user);
  const demo = useDashDemo();
  return user ?? (demo ? DEMO_USER : null);
}

/** Toggle do modo (renderizar apenas quando `admin`). */
export function DemoToggle({ className }: { className?: string }) {
  const { admin, on, setOn } = useDemoMode();
  if (!admin) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      title="Popula o painel com dados fictícios para apresentações. Não grava nada."
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        on
          ? "border-amber-400 bg-amber-50 text-amber-800"
          : "border-sage-200 bg-white text-muted hover:border-sage hover:text-ink",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-4 w-7 rounded-full transition-colors",
          on ? "bg-amber-400" : "bg-sage-200"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform",
            on ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </span>
      Modo demonstração
    </button>
  );
}

/** Faixa fixa no topo do painel enquanto o modo está ligado. */
export function DemoBanner() {
  const { on } = useDemoMode();
  if (!on) return null;
  return (
    <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-900 print:hidden">
      Modo demonstração · dados fictícios · não são dados reais
    </div>
  );
}

/** Selo pequeno "exemplo" perto dos dados populados pelo seed. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800",
        className
      )}
    >
      exemplo
    </span>
  );
}
