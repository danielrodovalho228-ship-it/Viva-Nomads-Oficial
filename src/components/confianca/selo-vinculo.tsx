import { BadgeCheck } from "lucide-react";
import { seloVinculoPublico } from "@/lib/vinculo/textos";
import { cn } from "@/lib/utils";

/**
 * E174-B — o selo "Vínculo profissional · <domínio>", componente ÚNICO, no mesmo desenho do selo do LinkedIn: ícone +
 * texto, discreto, nunca link. Só o domínio confirmado, nunca o e-mail. `pilula` onde os selos vizinhos são pílulas.
 */
export function SeloVinculo({ dominio, formato = "linha", className }: { dominio: string | null | undefined; formato?: "linha" | "pilula"; className?: string }) {
  const texto = seloVinculoPublico(dominio);
  if (!texto) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold text-forest",
        formato === "pilula" && "rounded-full border border-line bg-white px-3 py-1",
        className,
      )}
      data-testid="selo-vinculo"
      data-formato={formato}
    >
      <BadgeCheck className={formato === "pilula" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden /> {texto}
    </span>
  );
}
