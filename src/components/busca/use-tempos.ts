"use client";

import { useEffect, useRef, useState } from "react";
import { chaveDoDestino, corpoDoDestino, type DestinoBusca } from "@/lib/busca/destino-busca";
import type { ModoRota } from "@/lib/rotas/tempo";

export interface TempoDoImovel {
  texto: string;
  /** Minutos arredondados (0 = menos de 5); null = linha reta. */
  min: number | null;
  pos: number | null;
}

interface Resposta {
  chave: string;
  tempos: Map<string, TempoDoImovel>;
  reta: boolean;
  pronto: boolean;
}

/**
 * Tempos até o destino da busca (prompt 37), pedidos ao servidor DEPOIS que a lista aparece — a lista nunca trava.
 * Enquanto não chegam, `carregando` (o cartão mostra "calculando…"); com `calculando` do servidor, pede de novo
 * sozinho (até 5 vezes, a cada 3 s). A resposta guarda a chave do pedido: trocou destino, meio ou lista, a anterior
 * deixa de valer sem precisar zerar nada.
 */
export function useTempos(destino: DestinoBusca | null, modo: ModoRota, ids: string[]) {
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const contou = useRef("");
  const chaveIds = ids.slice().sort().join(",");
  const chaveDestino = destino ? `${chaveDoDestino(destino)}|${modo}` : "";
  const chave = chaveDestino && chaveIds ? `${chaveDestino}|${chaveIds}` : "";

  useEffect(() => {
    if (!chave || !destino) return;
    let vivo = true;
    let tentativas = 0;
    let timer: number | undefined;
    const pedir = async () => {
      try {
        const res = await fetch("/api/tempos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...corpoDoDestino(destino), modo, ids: chaveIds.split(","), contar: contou.current !== chaveDestino }),
        });
        contou.current = chaveDestino;
        const j = (await res.json()) as { itens?: ({ id: string } & TempoDoImovel)[]; calculando?: boolean; reta?: boolean };
        if (!vivo) return;
        const repetir = Boolean(j.calculando) && tentativas++ < 5;
        setResposta({
          chave,
          tempos: new Map((j.itens ?? []).map((i) => [i.id, { texto: i.texto, min: i.min, pos: i.pos }])),
          reta: Boolean(j.reta),
          pronto: !repetir,
        });
        if (repetir) timer = window.setTimeout(pedir, 3000);
      } catch {
        if (vivo) setResposta({ chave, tempos: new Map(), reta: false, pronto: true });
      }
    };
    void pedir();
    return () => {
      vivo = false;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- destino e modo estão em `chave`
  }, [chave]);

  const valida = resposta && resposta.chave === chave ? resposta : null;
  return {
    tempos: valida?.tempos ?? new Map<string, TempoDoImovel>(),
    carregando: Boolean(chave) && !valida?.pronto,
    reta: valida?.reta ?? false,
  };
}
