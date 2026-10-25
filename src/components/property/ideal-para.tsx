import { idealParaRotulos } from "@/lib/ideal-para";
import type { Property } from "@/lib/types";

/** Linha "Ideal para: …" derivada dos dados do anúncio (ordem 507074ce). Some quando não há nenhum. */
export function IdealPara({ property, className = "" }: { property: Property; className?: string }) {
  const rotulos = idealParaRotulos(property);
  if (rotulos.length === 0) return null;
  return (
    <p className={`text-xs text-muted ${className}`} data-testid="ideal-para">
      <span className="font-semibold text-ink">Ideal para:</span> {rotulos.join(" · ")}
    </p>
  );
}
