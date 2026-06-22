"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";
import type { UserRole } from "@/lib/types";

/**
 * Sincroniza a sessão do Supabase com o estado global (Zustand).
 * Em modo demonstração (sem Supabase), não faz nada e o login local persiste.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    function hydrate(session: import("@supabase/supabase-js").Session | null) {
      if (!session?.user) {
        setUser(null);
        return;
      }
      const u = session.user;
      // `fullName` é o nome real coletado (pode faltar). `name` é só para
      // exibição (saudação/avatar) e cai no e-mail completo quando não há nome —
      // nunca usa a parte local do e-mail como se fosse um nome.
      const fullName = (u.user_metadata?.full_name as string | undefined) || undefined;
      setUser({
        id: u.id,
        name: fullName ?? u.email ?? "Usuário",
        fullName,
        email: u.email ?? "",
        role: (u.user_metadata?.role as UserRole) ?? "tenant",
      });
    }

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      hydrate(session)
    );
    return () => sub.subscription.unsubscribe();
  }, [setUser]);

  return <>{children}</>;
}
