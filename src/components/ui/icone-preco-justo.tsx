import { Check, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * E626: o símbolo do selo "Preço justo" — uma etiqueta com visto (Tag + Check). Trocou o BadgePercent (o "%" lia como
 * desconto/promoção). O mesmo ícone no cartão da busca, na página do imóvel e na ficha da comparação.
 */
export function IconePrecoJusto({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden data-testid="icone-preco-justo">
      <Tag className="h-full w-full" />
      <Check className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 stroke-[4]" />
    </span>
  );
}
