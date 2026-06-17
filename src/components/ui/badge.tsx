import * as React from "react";
import { Award, FileText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Selo dourado "Pronto para Trabalho" — diferencial visual do Viva Nomads. */
export function WorkReadyBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-champagne px-2.5 py-1 text-xs font-semibold text-forest shadow-sm",
        className
      )}
    >
      <Award className="h-3.5 w-3.5" aria-hidden />
      Pronto para Trabalho
    </span>
  );
}

/** Selo "Emite Nota Fiscal" (Atualização 7) — decisivo para o público corporativo. */
export function InvoiceBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-forest px-2.5 py-1 text-xs font-semibold text-white shadow-sm",
        className
      )}
    >
      <FileText className="h-3.5 w-3.5" aria-hidden />
      Emite Nota Fiscal
    </span>
  );
}

/** Selo "Aceita Seguro-Fiança" (Atualização 10) — sinaliza segurança. */
export function InsuranceBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-sage px-2.5 py-1 text-xs font-semibold text-white shadow-sm",
        className
      )}
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      Aceita Seguro-Fiança
    </span>
  );
}

export function Tag({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest",
        className
      )}
    >
      {children}
    </span>
  );
}
