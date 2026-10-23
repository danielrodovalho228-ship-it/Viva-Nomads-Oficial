import { BadgeCheck } from "lucide-react";
import { SELO_LINKEDIN } from "@/lib/linkedin/regras";
import { cn } from "@/lib/utils";

/**
 * 63-B — o selo "LinkedIn conectado": só o texto. Nunca link, nome ou foto do LinkedIn (o endereço do perfil é privado).
 * Não entra no cartão do imóvel.
 */
export function SeloLinkedin({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-forest", className)} data-testid="selo-linkedin">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {SELO_LINKEDIN}
    </span>
  );
}
