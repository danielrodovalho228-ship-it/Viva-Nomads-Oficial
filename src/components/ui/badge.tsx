import * as React from "react";
import { Award, FileText, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Selo "Proprietário Responsivo" (Bloco C) — responde/resolve rápido. */
export function ResponsiveOwnerBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700",
        className
      )}
    >
      <Zap className="h-3.5 w-3.5" aria-hidden />
      Proprietário Responsivo
    </span>
  );
}

/**
 * Selo "Pronto para Trabalho" — diferencial central da marca.
 * Peso visual real: gradiente azul→verde, ícone e contorno.
 */
export function WorkReadyBadge({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold text-white shadow-sm bg-gradient-brand",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
        className
      )}
    >
      <Award className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      Pronto para Trabalho
    </span>
  );
}

/** Selo "Emite Nota Fiscal" — decisivo para o público corporativo. */
export function InvoiceBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700",
        className
      )}
    >
      <FileText className="h-3.5 w-3.5" aria-hidden />
      Emite Nota Fiscal
    </span>
  );
}

/** Selo "Aceita Seguro-Fiança" — sinaliza segurança. */
export function InsuranceBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-900",
        className
      )}
    >
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      Aceita Seguro-Fiança
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Eyebrow editorial (rótulo de seção). */
export function Eyebrow({
  children,
  light = false,
  className,
}: {
  children: React.ReactNode;
  light?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 font-title text-xs font-bold uppercase tracking-[0.18em]",
        light ? "text-green-300" : "text-blue-500",
        className
      )}
    >
      <span className={cn("h-px w-6", light ? "bg-green-300" : "bg-green-500")} />
      {children}
    </p>
  );
}
