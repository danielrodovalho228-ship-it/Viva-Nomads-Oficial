import type { RotuloPreco } from "@/lib/cartao-preco";
import { cn } from "@/lib/utils";

/**
 * Preço com contexto (Prompt 47): "R$ X/mês", o total do período e "Disponível a partir de…", sempre a partir de
 * rotuloPreco. Nenhuma tela monta o preço de imóvel à mão.
 */
export function PrecoComContexto({ rotulo, destaque = "base", className }: { rotulo: RotuloPreco; destaque?: "sm" | "base" | "lg"; className?: string }) {
  const tam = destaque === "lg" ? "text-xl" : destaque === "sm" ? "text-sm" : "text-base";
  return (
    <span className={cn("block tabular-nums", className)} data-testid="preco-contexto">
      <span className={cn("font-title font-semibold text-ink", tam)}>{rotulo.valor}</span>
      <span className="text-xs text-muted">/mês</span>
      {rotulo.estadia && <span className="block text-xs text-muted">{rotulo.estadia}</span>}
      {rotulo.disponivel && <span className="block text-xs text-muted">{rotulo.disponivel}</span>}
    </span>
  );
}
