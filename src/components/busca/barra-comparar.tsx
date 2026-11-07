"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { hrefComparar, MIN_COMPARAR } from "@/lib/busca/comparar";

/**
 * Barra "Comparar (N)" da busca (ordem fdd61de0). Só aparece com algo marcado.
 * E529 (D15; 3ª reprova de 06/11): era uma pílula FIXA, depois uma barra sticky no pé da coluna — as duas ficavam
 * FLUTUANDO sobre os cartões que passavam por baixo ao rolar. Agora é uma faixa NORMAL da página, logo acima da lista de
 * resultados (sem sticky nem fixed, sem sombra): ocupa o próprio espaço e nunca cobre cartão nenhum. O feedback de cada
 * marcação continua no próprio cartão (a caixinha "Comparar").
 */
export function BarraComparar({ ids, aviso, onLimpar }: { ids: string[]; aviso: string | null; onLimpar: () => void }) {
  const router = useRouter();
  if (ids.length === 0) return null;
  const pronto = ids.length >= MIN_COMPARAR;
  return (
    <div className="mt-3 rounded-xl border border-line bg-white px-4 py-3" data-testid="barra-comparar">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {aviso ? (
          <p role="status" className="text-sm text-ink" data-testid="comparar-aviso">{aviso}</p>
        ) : !pronto ? (
          <p role="status" className="text-sm text-muted">Marque mais 1 para comparar</p>
        ) : null}
        {pronto ? (
          <Link
            href={hrefComparar(ids)}
            // E532: leva a busca de agora (filtros e ordenação, lidos da URL no clique) para o "Voltar à busca".
            onClick={(e) => {
              e.preventDefault();
              router.push(hrefComparar(ids, window.location.search));
            }}
            className={buttonClasses({ size: "sm" })}
            data-testid="comparar-abrir"
          >
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
