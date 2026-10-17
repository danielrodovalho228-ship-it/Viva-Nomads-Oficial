import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { hrefComparar, MIN_COMPARAR } from "@/lib/busca/comparar";

/** Barra fixa "Comparar (N)" da busca (ordem fdd61de0). Só aparece com algo marcado. */
export function BarraComparar({ ids, aviso, onLimpar }: { ids: string[]; aviso: string | null; onLimpar: () => void }) {
  if (ids.length === 0) return null;
  const pronto = ids.length >= MIN_COMPARAR;
  return (
    <div className="vn-barra-comparar fixed inset-x-0 z-40 flex justify-center px-4" data-testid="barra-comparar">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-white px-4 py-2 shadow-lg">
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
          <span className="rounded-full bg-sage-200 px-4 py-2 text-sm font-semibold text-muted" data-testid="comparar-abrir" aria-disabled="true">
            Comparar ({ids.length})
          </span>
        )}
        <button type="button" onClick={onLimpar} className="text-sm text-muted underline underline-offset-2" data-testid="comparar-limpar">
          Limpar
        </button>
      </div>
    </div>
  );
}
