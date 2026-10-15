import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AVISO_ANTIGOLPE_TEXTO } from "@/lib/seguranca/antigolpe";

/** Aviso antigolpe curto (ordem 19cfa5b1): mesmo texto no anúncio, no pedido de moradia e em Mensagens. */
export function AvisoAntigolpe({ className = "" }: { className?: string }) {
  return (
    <p
      data-testid="aviso-antigolpe"
      className={`flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ${className}`}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {AVISO_ANTIGOLPE_TEXTO}{" "}
        <Link href="/seguranca" className="font-semibold underline underline-offset-2">
          Dicas de segurança
        </Link>
      </span>
    </p>
  );
}
