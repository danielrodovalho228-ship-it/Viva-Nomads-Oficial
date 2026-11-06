"use client";

import { useEffect, useState } from "react";
import { nomeDoDonoDepoisDoAceite } from "@/lib/data/nome-dono-actions";

/**
 * E427: a página do anúncio é estática (o HTML só leva o nome ABREVIADO). Quem tem o aceite com este dono (visita confirmada ou
 * relação aceita) recebe o nome COMPLETO do servidor depois de abrir; os demais (anônimo, público, sem aceite) ficam com
 * `null` e a tela segue com o abreviado. Uma regra só para o cartão do cabeçalho ("Proprietário: …") e para "Sobre o proprietário".
 */
export function useNomeDepoisDoAceite(donoId: string | null | undefined, exemplo: boolean): string | null {
  const [nome, setNome] = useState<string | null>(null);
  useEffect(() => {
    if (exemplo || !donoId) return;
    let vivo = true;
    nomeDoDonoDepoisDoAceite(donoId)
      .then((n) => vivo && setNome(n))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [exemplo, donoId]);
  return nome;
}
