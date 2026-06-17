import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "./types";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

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
