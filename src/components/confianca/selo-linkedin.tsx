import { BadgeCheck } from "lucide-react";
import { SELO_LINKEDIN } from "@/lib/linkedin/textos";
import { cn } from "@/lib/utils";

/**
 * 63-A — o selo "LinkedIn conectado", componente ÚNICO: ícone + texto, discreto, no mesmo desenho dos outros selos de
 * pessoa. Nunca é link e não leva nome, foto ou endereço do LinkedIn (o perfil é privado). Nunca no cartão do imóvel.
 * `pilula`: onde os selos vizinhos são pílulas (perfil público do proprietário, faixa do dono); `linha` no resto.
 * Só aparece quando o servidor diz que a pessoa tem o selo — com a chave LINKEDIN_CONECTAR_ATIVO desligada, ninguém tem.
 */
export function SeloLinkedin({ formato = "linha", className }: { formato?: "linha" | "pilula"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold text-forest",
        formato === "pilula" && "rounded-full border border-line bg-white px-3 py-1",
        className,
      )}
      data-testid="selo-linkedin"
      data-formato={formato}
    >
      <BadgeCheck className={formato === "pilula" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden /> {SELO_LINKEDIN}
    </span>
  );
}
