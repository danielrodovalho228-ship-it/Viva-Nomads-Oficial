"use client";

import { ITENS_CONFORTO } from "@/config/conforto-minimo";
import { TITULO_PADRAO_MINIMO } from "@/lib/conforto/exibicao";
import { Button } from "@/components/ui/button";
import { Pilula } from "@/components/anuncio/escolha-assistente";
import type { SalvamentoConforto } from "./use-conforto-salvo";

/**
 * Prompt 59 — checklist do padrão mínimo de conforto (o dono confirma item a item). Usado no passo Comodidades do cadastro (59-A) e na
 * página "Padrão mínimo" do imóvel. A lista vem de src/config/conforto-minimo.ts (uma só).
 */
export function ChecklistConforto({
  marcados,
  onChange,
  desabilitado = false,
  salvamento = null,
  onTentarDeNovo,
}: {
  marcados: readonly string[];
  onChange: (marcados: string[]) => void;
  desabilitado?: boolean;
  /** 59-C1: o checklist grava sozinho; este é o estado da gravação (ou da carga do que já estava salvo). */
  salvamento?: SalvamentoConforto;
  onTentarDeNovo?: () => void;
}) {
  const sel = new Set(marcados);
  const faltam = ITENS_CONFORTO.filter((i) => !sel.has(i.chave)).length;
  const alterna = (chave: string) => onChange(sel.has(chave) ? marcados.filter((k) => k !== chave) : [...marcados, chave]);
  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="conforto-checklist" data-faltam={faltam}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{TITULO_PADRAO_MINIMO}</p>
          <p className="mt-1 text-xs text-muted">
            Confirme cada item. Sem todos confirmados, o anúncio não é publicado. O morador confere na entrada.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={desabilitado || faltam === 0}
          onClick={() => onChange(ITENS_CONFORTO.map((i) => i.chave))}
          data-testid="conforto-marcar-todos"
        >
          Confirmo todos
        </Button>
      </div>
      {/* E193: várias escolhas = pílulas (antes, caixas quadradas). O critério de cada item continua à vista. */}
      <ul className="mt-3 space-y-3">
        {ITENS_CONFORTO.map((i) => (
          <li key={i.chave} data-testid={`conforto-item-${i.chave}`}>
            <Pilula on={sel.has(i.chave)} onClick={() => alterna(i.chave)} disabled={desabilitado}>
              {i.rotulo}
            </Pilula>
            <span className="mt-1 block pl-4 text-xs text-muted">{i.criterio}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted" data-testid="conforto-faltam">
        {faltam === 0 ? "Todos os itens confirmados." : faltam === 1 ? "Falta confirmar 1 item." : `Faltam confirmar ${faltam} itens.`}
      </p>
      {salvamento && (
        <div
          className="mt-2 flex flex-wrap items-center gap-3"
          data-testid="conforto-salvamento"
          data-estado={salvamento.estado}
          role={salvamento.estado === "erro" ? "alert" : "status"}
        >
          <p className={salvamento.estado === "erro" ? "text-sm text-red-700" : "text-sm text-ink"}>
            {salvamento.estado === "salvando" ? "Salvando…" : salvamento.estado === "salvo" ? "Confirmação salva" : salvamento.erro}
          </p>
          {salvamento.estado === "erro" && onTentarDeNovo && (
            <Button type="button" variant="outline" size="sm" onClick={onTentarDeNovo} data-testid="conforto-tentar-de-novo">
              Tentar de novo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
