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
      const metaName = (u.user_metadata?.full_name as string | undefined) || undefined;
      const metaRole = (u.user_metadata?.role as UserRole) ?? "tenant";

      // Loga IMEDIATAMENTE a partir da sessão — o login NUNCA fica preso na
      // consulta a `profiles` (que pode estar vazia/lenta/indisponível). O
      // `name` é só para exibição e cai no e-mail completo quando não há nome.
      setUser({
        id: u.id,
        name: metaName ?? u.email ?? "Usuário",
        fullName: metaName,
        email: u.email ?? "",
        role: metaRole,
      });

      // Enriquece com o perfil (fonte CONFIÁVEL de nome/papel para a UI) sem
      // travar o login; a autorização de admin é validada no servidor (proxy).
      try {
        const { data: profile } = await supabase!
          .from("profiles")
          .select("full_name, role")
          .eq("id", u.id)
          .maybeSingle();
        if (profile && (profile.full_name || profile.role)) {
          setUser({
            id: u.id,
            name: profile.full_name ?? metaName ?? u.email ?? "Usuário",
            fullName: profile.full_name ?? metaName,
            email: u.email ?? "",
            role: (profile.role as UserRole) ?? metaRole,
          });
        }
      } catch {
        /* mantém o usuário já setado a partir da sessão */
      }
    }

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      hydrate(session)
    );
    return () => sub.subscription.unsubscribe();
  }, [setUser]);

  return <>{children}</>;
}
