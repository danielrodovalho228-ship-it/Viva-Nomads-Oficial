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
  /**
   * A sessão já foi CONFERIDA (getSession do Supabase resolveu, ou o modo demo
   * assumiu). NÃO é persistida: começa `false` a cada carga e evita que o
   * AuthGuard mande para /auth antes de a sessão real ter chance de hidratar
   * (a causa do "entra e sai" ao navegar).
   */
  authChecked: boolean;
  setAuthChecked: (v: boolean) => void;
  /**
   * Momento do login (epoch ms). A sessão expira 24h depois — o AuthProvider
   * desloga e pede login de novo. Persistido para valer entre recargas/abas.
   */
  sessionStartedAt: number | null;
  /** Inicia (ou reinicia) o relógio de 24h — chamado no login. */
  startSession: () => void;
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
      authChecked: false,
      sessionStartedAt: null,
      setAuthChecked: (authChecked) => set({ authChecked }),
      startSession: () => set({ sessionStartedAt: Date.now() }),
      // Setar o usuário implica que a sessão foi conferida.
      setUser: (user) => set({ user, authChecked: true }),
      setActiveMode: (activeMode) => set({ activeMode }),
      activateRole: (mode) =>
        set((s) => ({
          activeMode: mode,
          user: s.user
            ? { ...s.user, ...(mode === "owner" ? { isOwner: true } : { isTenant: true }) }
            : s.user,
        })),
      signOut: () =>
        set({ user: null, activeMode: null, authChecked: true, sessionStartedAt: null }),
    }),
    {
      name: "vivanomads-auth",
      // Persistimos usuário, papel ativo e o início da sessão (relógio de 24h).
      // `authChecked` fica de fora para recomeçar `false` a cada carga.
      partialize: (s) => ({
        user: s.user,
        activeMode: s.activeMode,
        sessionStartedAt: s.sessionStartedAt,
      }),
    }
  )
);
