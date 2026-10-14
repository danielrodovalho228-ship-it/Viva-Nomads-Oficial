import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Botões do site (ordem c67e818f): UM primário e UM secundário, iguais em
 * qualquer página. A forma segue as qualidades de botão do Furnished Finder
 * (cantos de 8 px, altura folgada, padding proporcional ao tamanho, texto
 * semibold numa linha só, hover que escurece e foco visível com anel); as cores
 * são as da Viva Nomads (verde-marca com texto branco).
 *
 * - primary   → ação principal da tela (fundo verde-marca, texto branco)
 * - secondary → ação de apoio (fundo branco, borda e texto verde-marca)
 * - ghost     → ação discreta (só texto), ex.: "Entrar" no cabeçalho
 * - inverse   → primário sobre fundo verde-marca (branco com texto verde);
 *               `inverseSecondary` é o secundário nesse fundo
 * - night     → preto de marca (usos pontuais)
 * `accent`/`gold` e `outline` são nomes antigos: viram primary e secondary.
 *
 * O texto nunca quebra (whitespace-nowrap) e o botão não encolhe abaixo dele.
 */
type Variant = "primary" | "secondary" | "ghost" | "inverse" | "inverseSecondary" | "night" | "accent" | "gold" | "outline";
type Size = "sm" | "md" | "lg";

const PRIMARY = "bg-blue-500 text-white shadow-sm hover:bg-blue-700 hover:shadow-md";
const SECONDARY = "border border-blue-500 bg-white text-blue-500 hover:bg-blue-50";

const variants: Record<Variant, string> = {
  primary: PRIMARY,
  accent: PRIMARY,
  gold: PRIMARY,
  secondary: SECONDARY,
  outline: SECONDARY,
  ghost: "text-blue-500 hover:bg-blue-50",
  inverse: "bg-white text-blue-500 shadow-sm hover:bg-blue-50 hover:shadow-md focus-visible:ring-white focus-visible:ring-offset-blue-500",
  inverseSecondary: "border border-white/70 text-white hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-blue-500",
  night: "bg-night text-white shadow-sm hover:bg-night/85 hover:shadow-md",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-5 text-sm sm:px-6 sm:text-[15px]",
  lg: "h-14 px-6 text-[15px] sm:px-8 sm:text-base",
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold leading-none tracking-tight transition-[background-color,box-shadow,color,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-px [&_svg]:shrink-0";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

/** Classes do botão para elementos que não são <Button>/<ButtonLink> (ex.: <a> externo, <label>). */
export function buttonClasses({ variant = "primary", size = "md", className }: CommonProps = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={buttonClasses({ variant, size, className })} data-cta={variant === "ghost" ? undefined : ""} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: CommonProps & { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <Link href={href} className={buttonClasses({ variant, size, className })} data-cta={variant === "ghost" ? undefined : ""} {...props} />;
}
