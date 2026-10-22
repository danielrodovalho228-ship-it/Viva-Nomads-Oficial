/* eslint-disable @next/next/no-img-element -- foto do anúncio, já reduzida no envio */
import type { ReactNode } from "react";

/** Rótulo fixo das telas de estadia, visitas e contratos (Prompt 43, item 7). A Viva não toca no dinheiro. */
export const TEXTO_VALOR_DIRETO = "O valor mensal vai direto ao proprietário. A Viva não recebe esse valor.";

export function ValorDiretoAoProprietario({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-sm text-muted"} data-testid="valor-direto-proprietario">
      {TEXTO_VALOR_DIRETO}
    </p>
  );
}

/**
 * Cabeçalho de contexto (Prompt 43, item 7): o imóvel com a foto, o tipo da tela e as datas — o mesmo desenho nas
 * mensagens, na estadia, nas visitas e nos contratos. Sem foto, só o texto (nenhum espaço reservado vazio).
 */
export function CabecalhoContexto(p: { foto?: string | null; tipo: string; titulo: string; linha?: ReactNode; testId?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3" data-testid={p.testId ?? "cabecalho-contexto"}>
      {p.foto && <img src={p.foto} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover" />}
      <div className="min-w-0">
        <p className="text-xs text-muted">{p.tipo}</p>
        <p className="truncate text-sm font-semibold text-ink">{p.titulo}</p>
        {p.linha && <p className="text-xs text-muted">{p.linha}</p>}
      </div>
    </div>
  );
}
