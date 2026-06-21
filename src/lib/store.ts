import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "./types";

/** Planos de assinatura do proprietário (constants.PLANS). */
export type SubscriptionPlan = "free" | "essential" | "pro" | "gestor";

/**
 * Papel ATIVO na interface (rodada 19). A mesma pessoa pode ser proprietária e
 * inquilina; `ViewMode` é o "mundo" em que ela está navegando agora — separado
 * do `role` de cadastro, que continua governando permissões reais.
 */
export type ViewMode = "owner" | "tenant";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Nome real coletado (separado do handle/e-mail). Vazio se não informado. */
  fullName?: string;
  /** Plano vigente — habilita recursos de operador (Gestor). */
  plan?: SubscriptionPlan;
  /** Papéis ativados na conta. Quando ausentes, derivam-se de `role`. */
  isOwner?: boolean;
  isTenant?: boolean;
}

/** Identidade de demonstração quando não há login (modo demo). */
export const DEMO_USER: SessionUser = {
  id: "demo-owner",
  name: "Marcos Andrade",
  email: "marcos@exemplo.com",
  role: "owner",
  fullName: "Marcos Andrade",
  // Demo no plano Gestor para exibir os recursos de operador (Atualização 12).
  plan: "gestor",
  // Demo com os dois papéis para exibir a troca de modo (rodada 19).
  isOwner: true,
  isTenant: true,
};

interface AuthState {
  user: SessionUser | null;
  /** Papel ativo escolhido pelo usuário; null = derivar do `role` de cadastro. */
  activeMode: ViewMode | null;
  /** Define o usuário logado (modo demo ou pós-login Supabase). */
  setUser: (user: SessionUser | null) => void;
  /** Troca o papel ativo (inquilino ⇄ proprietário). */
  setActiveMode: (mode: ViewMode) => void;
  /** Ativa o segundo papel na conta (convite de conversão) e entra nele. */
  activateRole: (mode: ViewMode) => void;
  signOut: () => void;
}

/**
 * Estado global de sessão. Persistido em localStorage para o modo demo
 * (enquanto a sessão real do Supabase não está conectada) — inclui o
 * `activeMode`, para a plataforma lembrar o último papel ativo ao voltar.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      activeMode: null,
      setUser: (user) => set({ user }),
      setActiveMode: (activeMode) => set({ activeMode }),
      activateRole: (mode) =>
        set((s) => ({
          activeMode: mode,
          user: s.user
            ? { ...s.user, ...(mode === "owner" ? { isOwner: true } : { isTenant: true }) }
            : s.user,
        })),
      signOut: () => set({ user: null, activeMode: null }),
    }),
    { name: "vivanomads-auth" }
  )
);
