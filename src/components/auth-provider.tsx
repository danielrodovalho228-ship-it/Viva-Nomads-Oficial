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

    // Perfil lido UMA vez por usuário nesta carga de página. Antes, cada evento
    // de auth (getSession, INITIAL_SESSION, TOKEN_REFRESHED…) relia o perfil,
    // reescrevia o usuário e REAPLICAVA o modo salvo — se o clique no seletor
    // acontecia antes da última leitura voltar, ela desfazia a troca ("só
    // funciona no segundo clique") e a casca re-renderizava várias vezes.
    const perfilLido = new Set<string>();

    async function hydrate(
      session: import("@supabase/supabase-js").Session | null,
      forcarPerfil = false
    ) {
      if (!session?.user) {
        setUser(null);
        return;
      }
      const u = session.user;
      const metaName = (u.user_metadata?.full_name as string | undefined) || undefined;
      const metaRole = (u.user_metadata?.role as UserRole) ?? "tenant";
      const atual = useAuthStore.getState().user;

      // Loga IMEDIATAMENTE a partir da sessão — o login NUNCA fica preso na
      // consulta a `profiles`. Só quando ainda não há este usuário no estado:
      // não rebaixa um usuário já completo (papel/plano do perfil) para o da sessão.
      if (!atual || atual.id !== u.id) {
        setUser({
          id: u.id,
          name: metaName ?? u.email ?? "Usuário",
          fullName: metaName,
          email: u.email ?? "",
          role: metaRole,
        });
      }

      if (perfilLido.has(u.id) && !forcarPerfil) return;
      perfilLido.add(u.id);

      // Modo no INÍCIO da leitura: se o usuário trocar de modo enquanto o
      // perfil carrega, a escolha dele vence o valor salvo.
      const modoAntes = useAuthStore.getState().activeMode;

      // Enriquece com o perfil (fonte CONFIÁVEL de nome/papel para a UI) sem
      // travar o login; a autorização de admin é validada no servidor (proxy).
      try {
        const { data: profile } = await supabase!
          .from("profiles")
          .select("full_name, role, preferred_mode")
          .eq("id", u.id)
          .maybeSingle();
        if (profile && (profile.full_name || profile.role)) {
          const agora = useAuthStore.getState().user;
          setUser({
            ...(agora && agora.id === u.id ? agora : {}),
            id: u.id,
            name: profile.full_name ?? metaName ?? u.email ?? "Usuário",
            fullName: profile.full_name ?? metaName,
            email: u.email ?? "",
            role: (profile.role as UserRole) ?? metaRole,
          });
        }
        // Modo ativo é PREFERÊNCIA DE PERFIL (B1): o servidor é a autoridade no
        // login — salvo se o usuário já trocou de modo durante a leitura.
        const pm = (profile as { preferred_mode?: string } | null)?.preferred_mode;
        if ((pm === "owner" || pm === "tenant") && useAuthStore.getState().activeMode === modoAntes) {
          setActiveMode(pm);
        }
      } catch {
        perfilLido.delete(u.id); // tenta de novo no próximo evento
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
      // Sessão NOVA (login, link de recuperação/confirmação): reinicia o relógio
      // de 24h. Sem isso, um carimbo antigo no navegador fazia a sessão recém-
      // criada ser tratada como "vencida" e o site deslogava na hora.
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        useAuthStore.getState().startSession();
      }
      // Link de recuperação que caiu fora de /auth/reset (ex.: redirecionamento
      // não autorizado no Supabase → home): leva para a tela de nova senha.
      if (
        event === "PASSWORD_RECOVERY" &&
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/auth/reset")
      ) {
        window.location.href = "/auth/reset";
        return;
      }
      // Login novo ou perfil alterado: relê o perfil. Demais eventos (sessão
      // inicial, renovação do token) não precisam ler de novo.
      if (session) hydrate(session, event === "SIGNED_IN" || event === "USER_UPDATED");
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
