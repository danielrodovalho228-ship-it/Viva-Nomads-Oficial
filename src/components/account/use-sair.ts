"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { removerPushToken } from "@/lib/data/push-actions";
import { createClient } from "@/lib/supabase/client";
import { ESCOPO_SAIR } from "@/lib/sessao/escopo-saida";

/** Sair da conta neste aparelho: tira o aviso no celular deste aparelho, encerra a sessão e volta às boas-vindas. */
export function useSair() {
  const router = useRouter();
  const { signOut } = useAuthStore();
  return async function sair() {
    try {
      const t = localStorage.getItem("vn-push-token");
      if (t) {
        removerPushToken(t).catch(() => {});
        localStorage.removeItem("vn-push-token");
      }
    } catch {
      /* segue */
    }
    // E391 (1): só ESTE aparelho (sem escopo, o Supabase encerrava a sessão em todos).
    await createClient()?.auth.signOut({ scope: ESCOPO_SAIR }).catch(() => {});
    signOut();
    router.replace("/app/boas-vindas");
  };
}
