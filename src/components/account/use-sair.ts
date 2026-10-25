"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { removerPushToken } from "@/lib/data/push-actions";
import { createClient } from "@/lib/supabase/client";

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
    await createClient()?.auth.signOut().catch(() => {});
    signOut();
    router.replace("/app/boas-vindas");
  };
}
