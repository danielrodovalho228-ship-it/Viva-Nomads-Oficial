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

    async function hydrate(session: import("@supabase/supabase-js").Session | null) {
      if (!session?.user) {
        setUser(null);
        return;
      }
      const u = session.user;
      // O perfil em `profiles` é a fonte CONFIÁVEL de nome e papel — o
      // user_metadata é editável pelo próprio usuário, então não vale para
      // autorização. Usamos os valores do perfil quando existem.
      let fullName = (u.user_metadata?.full_name as string | undefined) || undefined;
      let role = (u.user_metadata?.role as UserRole) ?? "tenant";
      const { data: profile } = await supabase!
        .from("profiles")
        .select("full_name, role")
        .eq("id", u.id)
        .single();
      if (profile?.full_name) fullName = profile.full_name;
      if (profile?.role) role = profile.role as UserRole;

      // `name` é só para exibição (saudação/avatar) e cai no e-mail completo
      // quando não há nome — nunca usa a parte local do e-mail como nome.
      setUser({
        id: u.id,
        name: fullName ?? u.email ?? "Usuário",
        fullName,
        email: u.email ?? "",
        role,
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
