import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * E176 — o padrão ÚNICO de voltar: um link "← <lista>" no TOPO das telas de detalhe (contrato, estadia, fechamento).
 * Leva sempre à lista de origem (nunca ao histórico): o mesmo destino no celular e no computador. Listas não têm voltar
 * (a navegação é a aba/barra).
 */
export function VoltarLista({ href, rotulo, className }: { href: string; rotulo: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:underline", className)}
      data-testid="voltar-lista"
    >
      <span aria-hidden>←</span> {rotulo}
    </Link>
  );
}
