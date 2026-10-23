"use client";

import { ITENS_CONFORTO } from "@/config/conforto-minimo";
import { TITULO_PADRAO_MINIMO } from "@/lib/conforto/exibicao";
import { Button } from "@/components/ui/button";

/**
 * Prompt 59 — checklist do padrão mínimo de conforto (o dono confirma item a item). Usado no passo Comodidades do cadastro (59-A) e na
 * página "Padrão mínimo" do imóvel. A lista vem de src/config/conforto-minimo.ts (uma só).
 */
export function ChecklistConforto({
  marcados,
  onChange,
  desabilitado = false,
}: {
  marcados: readonly string[];
  onChange: (marcados: string[]) => void;
  desabilitado?: boolean;
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
      <ul className="mt-3 space-y-2">
        {ITENS_CONFORTO.map((i) => (
          <li key={i.chave}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink" data-testid={`conforto-item-${i.chave}`}>
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-forest"
                checked={sel.has(i.chave)}
                disabled={desabilitado}
                onChange={() => alterna(i.chave)}
              />
              <span className="min-w-0">
                <span className="font-semibold">{i.rotulo}</span>
                <span className="block text-xs text-muted">{i.criterio}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted" data-testid="conforto-faltam">
        {faltam === 0 ? "Todos os itens confirmados." : faltam === 1 ? "Falta confirmar 1 item." : `Faltam confirmar ${faltam} itens.`}
      </p>
    </div>
  );
}
