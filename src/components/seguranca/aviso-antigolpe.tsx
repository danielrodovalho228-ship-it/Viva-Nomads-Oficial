import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AVISO_ANTIGOLPE_LINHA, AVISO_ANTIGOLPE_TEXTO } from "@/lib/seguranca/antigolpe";

/**
 * Aviso antigolpe curto (ordem 19cfa5b1): mesmo texto no anúncio, no pedido de moradia e em Mensagens.
 * `variante="linha"` (prompt 12): uma linha discreta de 13 px sob o botão, com um texto antes (`antes`).
 */
export function AvisoAntigolpe({
  className = "",
  variante = "caixa",
  antes,
}: {
  className?: string;
  variante?: "caixa" | "linha";
  antes?: React.ReactNode;
}) {
  if (variante === "linha") {
    return (
      <p data-testid="aviso-antigolpe" className={`text-[13px] leading-relaxed text-muted ${className}`}>
        {antes ? <>{antes} </> : null}
        {AVISO_ANTIGOLPE_LINHA} —{" "}
        <Link href="/seguranca" className="font-semibold text-forest underline underline-offset-2">
          Dicas de segurança
        </Link>
        .
      </p>
    );
  }
  return (
    <p
      data-testid="aviso-antigolpe"
      className={`flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ${className}`}
    >
      <ShieldAlert className="mt-1 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {AVISO_ANTIGOLPE_TEXTO}{" "}
        <Link href="/seguranca" className="font-semibold underline underline-offset-2">
          Dicas de segurança
        </Link>
      </span>
    </p>
  );
}
