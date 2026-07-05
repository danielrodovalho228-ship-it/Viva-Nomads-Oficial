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
  const setAuthChecked = useAuthStore((s) => s.setAuthChecked);

  useEffect(() => {
    const supabase = createClient();
    // Sem Supabase (modo demo/preview): a sessão local já é a verdade — marca
    // conferido para o AuthGuard não ficar esperando.
    if (!supabase) {
      setAuthChecked(true);
      return;
    }

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

    // Conferência inicial: getSession lê o cookie/sessão vigente. Só aqui
    // decidimos "logado ou não" — e marcamos `authChecked` para liberar o guard.
    supabase.auth.getSession().then(({ data }) => {
      hydrate(data.session);
      setAuthChecked(true);
    });

    // Eventos de auth: NÃO deslogamos em eventos transitórios sem sessão (o
    // Supabase dispara INITIAL_SESSION com session=null antes de a sessão real
    // chegar — era o que causava o "pisca deslogado"). Só o SIGNED_OUT limpa.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }
      if (session) hydrate(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [setUser, setAuthChecked]);

  return <>{children}</>;
}
