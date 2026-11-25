"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { ehParceiroAprovado } from "@/lib/parceiros/painel-actions";
import { parceiroAprovadoAgora } from "@/lib/papel/aprovado-enquanto-le";

/**
 * Papel da barra inferior (Prompt 41, item 2), do lado do navegador. PAPEL-B: "parceiro" deixou de ser preferência
 * deste aparelho — é o papel ativo gravado no perfil (profiles.papel_ativo), espelhado em `parceiroAtivo` do store
 * (que o AuthProvider lê no login). Só vale com a parceria aprovada (papelAtivo confere).
 */
export function usePreferenciaParceiro(): boolean {
  return useAuthStore((s) => s.parceiroAtivo);
}

/**
 * A conta tem a parceria aprovada? (só com sessão; sem sessão, false sem chamar o servidor). E464: enquanto a leitura
 * não volta, vale o papel guardado (parceiroAprovadoAgora) — o cabeçalho não nasce como dono e troca para parceiro. A
 * leitura fica guardada com a conta que a fez (outra conta neste aparelho não herda).
 */
export function useParceiroAprovado(): boolean {
  const userId = useAuthStore((s) => s.user?.id);
  const preferencia = useAuthStore((s) => s.parceiroAtivo);
  const [lido, setLido] = useState<{ id: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    ehParceiroAprovado()
      .then((t) => vivo && setLido({ id: userId, ok: t }))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [userId]);
  return !!userId && parceiroAprovadoAgora(lido && lido.id === userId ? lido.ok : null, preferencia);
}
