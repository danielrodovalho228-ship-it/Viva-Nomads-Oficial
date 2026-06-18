import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selo de verificação de identidade (rodada 13).
 *
 * Hoje renderiza o modo GENÉRICO ("tecnologia antifraude"), sem logo de
 * terceiro — não exibimos a marca do fornecedor enquanto não há parceria
 * fechada e autorização de uso de marca.
 *
 * Quando a parceria existir, passe `partnerName` + `partnerLogo` (URL do logo
 * autorizado) para exibir o selo do parceiro. Mantém a mesma posição/estilo.
 */
export function VerificationBadge({
  partnerName,
  partnerLogo,
  className,
}: {
  partnerName?: string;
  partnerLogo?: string;
  className?: string;
}) {
  const authorized = Boolean(partnerName && partnerLogo);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700",
        className
      )}
    >
      {authorized ? (
        <>
          <Image
            src={partnerLogo as string}
            alt={partnerName as string}
            width={16}
            height={16}
            className="h-4 w-4 rounded"
          />
          Verificação de identidade · {partnerName}
        </>
      ) : (
        <>
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Verificação de identidade · tecnologia antifraude
        </>
      )}
    </span>
  );
}
