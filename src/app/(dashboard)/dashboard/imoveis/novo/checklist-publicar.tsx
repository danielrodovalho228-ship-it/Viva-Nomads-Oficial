"use client";

import { CheckCircle2, ChevronDown, ClipboardCheck, XCircle } from "lucide-react";
import type { ItemProntidao } from "@/lib/anuncio/prontidao";
import { cn } from "@/lib/utils";

/**
 * "Pronto para publicar" (prompt 22): UM portão só, visível desde o passo 1. A qualificação "Antes de anunciar" é um
 * item da lista — antes era um segundo bloqueio que só aparecia no fim. Cada item que falta tem "Resolver" (vai à
 * etapa certa; a qualificação abre ali mesmo, no painel lateral).
 *  • `recolhivel`: no topo do cadastro, um cartão que abre e fecha (fechado no celular, aberto no computador).
 *  • sem `recolhivel`: a lista da revisão, sempre aberta.
 */
export function ChecklistPublicar({
  itens,
  onResolver,
  recolhivel = false,
}: {
  itens: ItemProntidao[];
  onResolver: (item: ItemProntidao) => void;
  recolhivel?: boolean;
}) {
  const feitos = itens.filter((i) => i.ok).length;
  const faltam = itens.filter((i) => !i.ok);
  const lista = (
    <ul className="mt-3 space-y-1.5" data-testid="checklist-publicar-lista">
      {itens.map((c) => (
        <li key={c.key} className="flex items-center justify-between gap-2 text-sm" data-testid={`checklist-item-${c.key}`} data-ok={c.ok ? "1" : "0"}>
          <span className="flex min-w-0 items-center gap-2">
            {c.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-forest" aria-hidden /> : <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />}
            <span className={cn("min-w-0", c.ok ? "text-ink" : "text-muted")}>
              {c.label}
              {!c.ok && c.detalhe && <span className="text-xs"> ({c.detalhe})</span>}
              <span className="sr-only">{c.ok ? " — feito" : " — falta"}</span>
            </span>
          </span>
          {!c.ok && (
            <button
              type="button"
              onClick={() => onResolver(c)}
              className="shrink-0 text-xs font-semibold text-forest underline underline-offset-2"
              data-testid={`checklist-resolver-${c.key}`}
            >
              {c.key === "qualificacao" ? "Responder aqui" : "Resolver"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  if (!recolhivel) {
    return (
      <div className="rounded-xl border border-sage-200 p-4" data-testid="checklist-publicar" data-faltam={faltam.length}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Pronto para publicar?</p>
          <span className="text-xs text-muted">
            {feitos}/{itens.length}
          </span>
        </div>
        {faltam.length === 0 ? <p className="mt-2 text-sm text-forest">Tudo certo: só falta confirmar e publicar.</p> : null}
        {lista}
      </div>
    );
  }

  return (
    <details
      className="group mb-4 rounded-xl border border-sage-200 bg-white p-3 open:pb-4"
      data-testid="checklist-publicar"
      data-faltam={faltam.length}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
        <ClipboardCheck className="h-4 w-4 shrink-0 text-forest" aria-hidden />
        <span className="min-w-0 flex-1">
          <strong className="text-ink">Pronto para publicar:</strong>{" "}
          <span className="text-muted">
            {feitos} de {itens.length}
            {faltam.some((i) => i.key === "qualificacao") && <> · falta “Antes de anunciar”</>}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      {lista}
    </details>
  );
}
