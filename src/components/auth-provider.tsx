"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store";
import type { UserRole } from "@/lib/types";

/**
 * Sincroniza a sessão do Supabase com o estado global (Zustand).
 * Em modo demonstração (sem Supabase), não faz nada e o login local persiste.
 */
/** Tempo máximo de sessão: 24h desde o login → pede login de novo. */
const SESSION_MAX_MS = 24 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setAuthChecked = useAuthStore((s) => s.setAuthChecked);
  const setActiveMode = useAuthStore((s) => s.setActiveMode);

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
          .select("full_name, role, preferred_mode")
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
        // Modo ativo é PREFERÊNCIA DE PERFIL (B1): o servidor é a autoridade no
        // login. Se o perfil tem um modo salvo, ele vence o valor local — assim
        // refresh, deep-link, nova aba e outro dispositivo mantêm a escolha.
        const pm = (profile as { preferred_mode?: string } | null)?.preferred_mode;
        if (pm === "owner" || pm === "tenant") setActiveMode(pm);
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
  }, [setUser, setAuthChecked, setActiveMode]);

  // ── Expiração da sessão em 24h ───────────────────────────────────────────────
  // Roda em toda página (AuthProvider está no layout raiz). Ao logar, marca-se
  // `sessionStartedAt`; passadas 24h, desloga (Supabase + store) e leva ao login.
  // Sessões antigas (sem carimbo) ganham o relógio a partir de agora.
  useEffect(() => {
    function verificar() {
      const s = useAuthStore.getState();
      if (!s.user) return;
      if (!s.sessionStartedAt) {
        s.startSession(); // inicializa o relógio de sessões pré-existentes
        return;
      }
      if (Date.now() - s.sessionStartedAt > SESSION_MAX_MS) {
        createClient()
          ?.auth.signOut()
          .catch(() => {});
        s.signOut();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth?expired=1";
        }
      }
    }
    verificar();
    const id = setInterval(verificar, 60_000); // checa a cada minuto
    return () => clearInterval(id);
  }, []);

  return <>{children}</>;
}
