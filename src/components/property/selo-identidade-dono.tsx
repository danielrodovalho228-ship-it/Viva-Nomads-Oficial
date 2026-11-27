import { BadgeCheck } from "lucide-react";

/**
 * E1105 (ORDEM-DUET-477): o selo de identidade do dono na página do imóvel. Só se desenha quando a identidade do dono
 * está CONFIRMADA na fonte única (seloDoDono); o texto vem da própria fonte (estadoIdentidade), nunca daqui.
 */
export function SeloIdentidadeDono({ texto }: { texto: string }) {
  return (
    <span className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-sage-100 px-3 text-sm font-medium text-forest-700" data-testid="selo-identidade-dono">
      <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden /> {texto}
    </span>
  );
}
