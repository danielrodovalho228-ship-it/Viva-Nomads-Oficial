"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { ehParceiroAprovado } from "@/lib/parceiros/painel-actions";

/**
 * Papel da barra inferior (Prompt 41, item 2), do lado do navegador. PAPEL-B: "parceiro" deixou de ser preferência
 * deste aparelho — é o papel ativo gravado no perfil (profiles.papel_ativo), espelhado em `parceiroAtivo` do store
 * (que o AuthProvider lê no login). Só vale com a parceria aprovada (papelAtivo confere).
 */
export function usePreferenciaParceiro(): boolean {
  return useAuthStore((s) => s.parceiroAtivo);
}

/** A conta tem a parceria aprovada? (só com sessão; sem sessão, false sem chamar o servidor). */
export function useParceiroAprovado(): boolean {
  const userId = useAuthStore((s) => s.user?.id);
  const [aprovado, setAprovado] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    ehParceiroAprovado()
      .then((t) => vivo && setAprovado(t))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [userId]);
  return !!userId && aprovado;
}
