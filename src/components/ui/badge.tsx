import * as React from "react";
import { Award, FileText, ShieldCheck, Zap, Laptop, MapPin, Building2 } from "lucide-react";
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
 * Selo BASE "Pronto para Morar" (dourado, destaque) — Atualização 11.
 * Qualidade geral para estadia de meses. Imóveis sem ele entram como básicos.
 */
export function ReadyToLiveBadge({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-champagne font-semibold text-night shadow-sm",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
        className
      )}
    >
      <Award className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      Pronto para Morar
    </span>
  );
}

export type SpecTagKind = "home_office" | "work_located" | "condo";

const SPEC_TAG_META: Record<SpecTagKind, { label: string; icon: typeof Laptop }> = {
  home_office: { label: "Para trabalhar de casa", icon: Laptop },
  work_located: { label: "Bem localizado p/ trabalho", icon: MapPin },
  condo: { label: "Aceito em condomínio", icon: Building2 },
};

/** Etiqueta de especialização (verde sálvia, menor) — soma ao selo base. */
export function SpecTag({ kind, className }: { kind: SpecTagKind; className?: string }) {
  const meta = SPEC_TAG_META[kind];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-medium text-sage",
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  );
}

/**
 * Renderiza as etiquetas ativas de um imóvel.
 * Obs.: a etiqueta "Aceito em condomínio" está desativada por ora (rodada 12)
 * — afirmação jurídica pendente de parecer do advogado. O dado segue coletado.
 */
export function PropertyTags({
  property,
  className,
}: {
  property: { tagHomeOffice: boolean; tagWorkLocated: boolean; tagCondoApproved: boolean };
  className?: string;
}) {
  const any = property.tagHomeOffice || property.tagWorkLocated;
  if (!any) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {property.tagHomeOffice && <SpecTag kind="home_office" />}
      {property.tagWorkLocated && <SpecTag kind="work_located" />}
    </div>
  );
}

/**
 * Selo "Documentação conferida" — a equipe conferiu o DOCUMENTO enviado
 * (matrícula / contrato de gestão). NÃO afirma propriedade nem garante o imóvel
 * (ver a regra de vocabulário em scripts/check-consistency.mjs).
 */
export function DocConferidaBadge({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 font-semibold text-green-900",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
        className
      )}
    >
      <ShieldCheck className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      Documentação conferida
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
