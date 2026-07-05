"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/store";

/**
 * Proteção de rota no cliente (QA): rotas do dashboard só renderizam com sessão.
 * Sem usuário, redireciona para /auth. Começa sempre "não hidratado" (igual no
 * SSR e no cliente, sem mismatch) e marca hidratado após a reidratação do
 * localStorage (zustand persist) — assim não redireciona quem já está logado.
 * No servidor, o proxy (Next.js 16) faz o mesmo quando o Supabase está ativo.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authChecked = useAuthStore((s) => s.authChecked);
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
    if (hydrated && authChecked && !user) router.replace("/auth");
  }, [hydrated, authChecked, user, router]);

  // Com usuário → libera. Sem usuário mas ainda conferindo → aguarda (spinner).
  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-2">
        <Loader2 className="h-6 w-6 animate-spin text-forest" />
      </div>
    );
  }

  return <>{children}</>;
}
