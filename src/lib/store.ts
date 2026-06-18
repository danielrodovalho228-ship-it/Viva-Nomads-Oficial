import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "./types";

/** Planos de assinatura do proprietário (constants.PLANS). */
export type SubscriptionPlan = "free" | "essential" | "pro" | "gestor";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Plano vigente — habilita recursos de operador (Gestor). */
  plan?: SubscriptionPlan;
}

/** Identidade de demonstração quando não há login (modo demo). */
export const DEMO_USER: SessionUser = {
  id: "demo-owner",
  name: "Marcos Andrade",
  email: "marcos@exemplo.com",
  role: "owner",
  // Demo no plano Gestor para exibir os recursos de operador (Atualização 12).
  plan: "gestor",
};

interface AuthState {
  user: SessionUser | null;
  /** Define o usuário logado (modo demo ou pós-login Supabase). */
  setUser: (user: SessionUser | null) => void;
  signOut: () => void;
}

/**
 * Estado global de sessão. Persistido em localStorage para o modo demo
 * (enquanto a sessão real do Supabase não está conectada).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      signOut: () => set({ user: null }),
    }),
    { name: "vivanomads-auth" }
  )
);
