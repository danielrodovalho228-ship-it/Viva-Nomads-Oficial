"use client";

import { useEffect, useState } from "react";

/** O módulo dos dados fictícios do modo demonstração (só o TIPO: não entra no pacote de quem importa este arquivo). */
export type Exemplos = typeof import("./seed");

/**
 * E980: os dados FICTÍCIOS do modo demonstração (nomes, imóveis e valores de exemplo) iam no JavaScript de todas as
 * telas do painel, para toda conta, porque as telas importavam o seed de forma estática. Aqui ele é carregado SOB
 * DEMANDA — um arquivo à parte, pedido só quando o modo demonstração está ligado (só do admin).
 * Devolve `null` com o modo desligado e enquanto o arquivo carrega; as telas mostram lista vazia nesse instante.
 */
export function useExemplos(ativo: boolean): Exemplos | null {
  const [exemplos, setExemplos] = useState<Exemplos | null>(null);
  useEffect(() => {
    if (!ativo || exemplos) return;
    let vivo = true;
    void import("./seed").then((m) => {
      if (vivo) setExemplos(m);
    });
    return () => {
      vivo = false;
    };
  }, [ativo, exemplos]);
  return ativo ? exemplos : null;
}
