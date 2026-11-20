"use client";

import { useEffect, useState } from "react";
import { nomeDoDonoDepoisDoAceite } from "@/lib/data/nome-dono-actions";
import { createClient } from "@/lib/supabase/client";

/** Esperas (ms) antes de cada nova tentativa depois de uma FALHA de leitura/sessão (não depois de "sem aceite"). */
export const ESPERAS_NOVA_TENTATIVA = [1500, 4000] as const;

/**
 * E427: a página do anúncio é estática (o HTML só leva o nome ABREVIADO). Quem tem o aceite com este dono (visita confirmada ou
 * relação aceita) recebe o nome COMPLETO do servidor depois de abrir; os demais (anônimo, público, sem aceite) ficam com
 * `null` e a tela segue com o abreviado. Uma regra só para o cartão do cabeçalho ("Proprietário: …") e para "Sobre o proprietário".
 * Resiliência (reprova de 06/11): uma falha passageira (sessão ainda não pronta no servidor, leitura que não respondeu)
 * tenta de novo duas vezes, e a mudança da sessão no navegador (entrou, renovou o token) refaz o pedido — "sem aceite" de
 * verdade não repete.
 */
export function useNomeDepoisDoAceite(donoId: string | null | undefined, exemplo: boolean): string | null {
  const [nome, setNome] = useState<string | null>(null);
  useEffect(() => {
    if (exemplo || !donoId) return;
    let vivo = true;
    let achou = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const buscar = (tentativa: number) => {
      nomeDoDonoDepoisDoAceite(donoId)
        .then((r) => {
          if (!vivo) return;
          if (r.nome) {
            achou = true;
            setNome(r.nome);
          }
          else if (r.falhou && tentativa < ESPERAS_NOVA_TENTATIVA.length) timer = setTimeout(() => buscar(tentativa + 1), ESPERAS_NOVA_TENTATIVA[tentativa]);
        })
        .catch(() => {
          if (vivo && tentativa < ESPERAS_NOVA_TENTATIVA.length) timer = setTimeout(() => buscar(tentativa + 1), ESPERAS_NOVA_TENTATIVA[tentativa]);
        });
    };
    buscar(0);
    const sub = createClient()?.auth.onAuthStateChange((evento) => {
      if (!achou && (evento === "SIGNED_IN" || evento === "TOKEN_REFRESHED")) buscar(0);
    });
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      sub?.data.subscription.unsubscribe();
    };
  }, [exemplo, donoId]);
  return nome;
}
