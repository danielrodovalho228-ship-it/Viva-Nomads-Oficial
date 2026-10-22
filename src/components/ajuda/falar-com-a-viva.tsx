import Link from "next/link";
import { PROMESSA_ATENDIMENTO } from "@/config/atendimento";
import { cn } from "@/lib/utils";

/**
 * "Falar com a Viva" (Prompt 43, adendo de onboarding, item 5): texto terciário, sempre no mesmo lugar — no fim da
 * tela de decisão (proposta, pedido, contrato, pagamento registrado, verificação, saída) — com a promessa única.
 */
export function FalarComAViva({ className }: { className?: string }) {
  return (
    <p className={cn("mt-8 text-sm text-muted", className)} data-testid="falar-com-a-viva">
      <Link href="/ajuda" className="font-semibold text-ink underline underline-offset-4 hover:text-forest">
        Falar com a Viva
      </Link>{" "}
      · {PROMESSA_ATENDIMENTO}
    </p>
  );
}
