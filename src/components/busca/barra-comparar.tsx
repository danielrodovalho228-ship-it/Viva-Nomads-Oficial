import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { hrefComparar, MIN_COMPARAR } from "@/lib/busca/comparar";

/**
 * Barra "Comparar (N)" da busca (ordem fdd61de0). Só aparece com algo marcado.
 * E529 (D15): era uma pílula FIXA no meio da tela, flutuando sobre os cartões. Agora fica encaixada na coluna de
 * resultados: sticky no pé da coluna (acima das abas do celular, pela .vn-barra-comparar), na largura toda da coluna,
 * com fundo branco opaco e borda — no fim da lista ela vem DEPOIS do último cartão.
 */
export function BarraComparar({ ids, aviso, onLimpar }: { ids: string[]; aviso: string | null; onLimpar: () => void }) {
  if (ids.length === 0) return null;
  const pronto = ids.length >= MIN_COMPARAR;
  return (
    <div className="vn-barra-comparar sticky z-30 -mx-4 mt-6 border-t border-line bg-white px-4 py-3 shadow-flutuante sm:mx-0 sm:rounded-xl sm:border" data-testid="barra-comparar">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {aviso ? (
          <p role="status" className="text-sm text-ink" data-testid="comparar-aviso">{aviso}</p>
        ) : !pronto ? (
          <p role="status" className="text-sm text-muted">Marque mais 1 para comparar</p>
        ) : null}
        {pronto ? (
          <Link href={hrefComparar(ids)} className={buttonClasses({ size: "sm" })} data-testid="comparar-abrir">
            Comparar ({ids.length})
          </Link>
        ) : (
          <span className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-semibold text-muted" data-testid="comparar-abrir" aria-disabled="true">
            Comparar ({ids.length})
          </span>
        )}
        <button type="button" onClick={onLimpar} className="text-sm text-ink underline underline-offset-4" data-testid="comparar-limpar">
          Limpar
        </button>
      </div>
    </div>
  );
}
