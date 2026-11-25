"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { lerParceiroAprovado } from "@/lib/sessao/leituras-da-casca";
import { parceiroAprovadoAgora } from "@/lib/papel/aprovado-enquanto-le";
import { preferenciaParceiroEfetiva } from "@/lib/papel/papel-inicial";
import { usePapelInicialServidor } from "@/components/papel/papel-inicial-contexto";

/**
 * Papel da barra inferior (Prompt 41, item 2), do lado do navegador. PAPEL-B: "parceiro" deixou de ser preferência
 * deste aparelho — é o papel ativo gravado no perfil (profiles.papel_ativo), espelhado em `parceiroAtivo` do store
 * (que o AuthProvider lê no login). Só vale com a parceria aprovada (papelAtivo confere).
 * E1026: logo depois do login o store ainda não leu o perfil; até ele conhecer o papel desta conta, vale o que o
 * servidor leu ao montar o painel (antes, o cabeçalho nascia como dono e trocava para parceiro).
 */
export function usePreferenciaParceiro(): boolean {
  const guardado = useAuthStore((s) => s.parceiroAtivo);
  const papelConhecido = useAuthStore((s) => s.papelConhecido);
  const conta = useAuthStore((s) => s.user?.id);
  const servidor = usePapelInicialServidor();
  return preferenciaParceiroEfetiva({ guardado, papelConhecido, conta, servidor });
}

/**
 * A conta tem a parceria aprovada? (só com sessão; sem sessão, false sem chamar o servidor). E464: enquanto a leitura
 * não volta, vale o papel guardado (parceiroAprovadoAgora) — o cabeçalho não nasce como dono e troca para parceiro. A
 * leitura fica guardada com a conta que a fez (outra conta neste aparelho não herda).
 */
export function useParceiroAprovado(): boolean {
  const userId = useAuthStore((s) => s.user?.id);
  const preferencia = usePreferenciaParceiro();
  const [lido, setLido] = useState<{ id: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    // E1025: uma leitura por abertura de tela, repartida por todos os componentes que usam este hook.
    lerParceiroAprovado(userId)
      .then((t) => vivo && setLido({ id: userId, ok: t }))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [userId]);
  return !!userId && parceiroAprovadoAgora(lido && lido.id === userId ? lido.ok : null, preferencia);
}
