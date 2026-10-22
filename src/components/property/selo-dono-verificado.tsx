import { BadgeCheck } from "lucide-react";
import { EXPLICACAO_DONO_VERIFICADO } from "@/lib/anuncio/dono-verificado";

/**
 * Selo "Dono verificado" com explicação ao tocar ("o que significa"). Só renderize quando
 * `donoVerificado(property)` for verdadeiro. <details> nativo: funciona sem JS, no teclado e no celular.
 */
export function SeloDonoVerificado() {
  return (
    <details className="group mt-1" data-testid="selo-dono-verificado">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full bg-blue-50 px-3 text-sm font-medium text-blue-700 [&::-webkit-details-marker]:hidden">
        <BadgeCheck className="h-4 w-4" aria-hidden /> Dono verificado
        <span className="text-xs font-normal underline">o que significa?</span>
      </summary>
      <p className="mt-2 max-w-md text-sm text-muted" data-testid="selo-dono-verificado-explicacao">
        {EXPLICACAO_DONO_VERIFICADO}
      </p>
    </details>
  );
}
