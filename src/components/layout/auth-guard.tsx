"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { SkeletonLista } from "@/components/ui/skeleton";
import { useSessaoServidor, useUsuarioAtual } from "@/components/auth/sessao-servidor-contexto";
import { rotaLiberada } from "@/lib/auth/painel-sessao-servidor";

/**
 * Proteção de rota no cliente (QA): rotas do dashboard só renderizam com sessão.
 * Sem usuário, redireciona para /auth. Começa sempre "não hidratado" (igual no
 * SSR e no cliente, sem mismatch) e marca hidratado após a reidratação do
 * localStorage (zustand persist) — assim não redireciona quem já está logado.
 * No servidor, o proxy (Next.js 16) faz o mesmo quando o Supabase está ativo.
 *
 * E793 (A6): com a sessão conferida no servidor (chave PAINEL_SESSAO_SERVIDOR) E a rota atual na lista da onda ligada,
 * libera o conteúdo já no 1º quadro, com o usuário do contexto do servidor (useUsuarioAtual). Fora da lista — ou sem
 * contexto (chave off, sessão não lida) — é exatamente o comportamento de antes. O redirecionamento para /auth continua
 * vindo só da conferência do CLIENTE (2ª linha; a 1ª é o proxy).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const storeUser = useAuthStore((s) => s.user);
  const authChecked = useAuthStore((s) => s.authChecked);
  const sessao = useSessaoServidor();
  const usuarioDoQuadro = useUsuarioAtual();
  // A6: só a rota da onda ligada usa o usuário do servidor no 1º quadro; as demais seguem como hoje (store).
  const user = sessao && rotaLiberada(pathname, sessao.rotasLiberadas) ? usuarioDoQuadro : storeUser;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setHydrated(true);
      }
    };
    const unsub = useAuthStore.persist?.onFinishHydration(finish);
    // Se já reidratou antes deste efeito, conclui de forma assíncrona.
    if (useAuthStore.persist?.hasHydrated()) queueMicrotask(finish);
    return unsub;
  }, []);

  // Só redireciona quando: o localStorage já reidratou E a sessão do Supabase
  // já foi CONFERIDA (authChecked) E mesmo assim não há usuário. Sem o
  // `authChecked`, um /dashboard aberto direto (sem usuário persistido) mandava
  // para /auth antes de a sessão real hidratar — o "entra e sai".
  useEffect(() => {
    if (hydrated && authChecked && !storeUser) router.replace("/auth");
  }, [hydrated, authChecked, storeUser, router]);

  // Com usuário → libera. Sem usuário mas ainda conferindo → aguarda (spinner).
  if (!user) {
    return (
      <div className="min-h-screen bg-surface-2 px-4 py-8 sm:px-8" data-testid="auth-guard-carregando">
        <SkeletonLista />
      </div>
    );
  }

  return <>{children}</>;
}
