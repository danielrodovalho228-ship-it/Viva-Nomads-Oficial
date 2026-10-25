import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Botões do site (ordem c67e818f; padrão visual do Prompt 40, Estudo 1).
 * UM primário e UM secundário, iguais em qualquer página: cantos de 8 px,
 * 52 px de altura no celular e 56 px no computador (a partir de 1024 px),
 * texto semibold numa linha só, foco visível com anel e SEM sombra.
 *
 * - primary          → ação principal (fundo verde-marca, texto branco)
 * - secondary        → ação de apoio (mesmo tamanho, contorno tinta, fundo branco)
 * - tertiary         → texto sublinhado, sem caixa (ex.: "Limpar tudo")
 * - destructive      → texto vermelho sublinhado; nunca é primário
 * - ghost            → ação discreta (só texto, sem sublinhado), ex.: "Entrar" no cabeçalho
 * - inverse          → primário sobre fundo verde-marca/escuro (branco com texto verde);
 *                      `inverseSecondary` é o secundário nesse fundo
 * - night            → preto de marca (usos pontuais)
 * - busca, chip, flutuante → as ÚNICAS variantes em pill (rounded-full). A flutuante
 *                      é o único elemento do app com sombra (shadow-flutuante).
 * `accent`/`gold` e `outline` são nomes antigos: viram primary e secondary.
 *
 * O texto nunca quebra (whitespace-nowrap) e o botão não encolhe abaixo dele.
 */
type Variant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "destructive"
  | "ghost"
  | "inverse"
  | "inverseSecondary"
  | "night"
  | "accent"
  | "gold"
  | "outline"
  | "busca"
  | "chip"
  | "flutuante";
type Size = "sm" | "md" | "lg";

const PRIMARY = "bg-forest text-white hover:bg-forest-700";
const SECONDARY = "border border-ink bg-white text-ink hover:bg-surface-2";
/** Sem caixa: a altura e o recuo do tamanho não valem (só a área de toque de 44 px). */
const TEXTO = "h-auto min-h-11 bg-transparent px-0 sm:px-0 lg:h-auto underline underline-offset-4";

const variants: Record<Variant, string> = {
  primary: PRIMARY,
  accent: PRIMARY,
  gold: PRIMARY,
  secondary: SECONDARY,
  outline: SECONDARY,
  tertiary: `${TEXTO} text-ink hover:text-forest`,
  destructive: `${TEXTO} text-red-600 hover:text-red-700`,
  ghost: "text-forest hover:bg-surface-2",
  inverse: "bg-white text-forest hover:bg-surface-2 focus-visible:ring-white focus-visible:ring-offset-forest",
  inverseSecondary: "border border-white/70 text-white hover:bg-white/10 focus-visible:ring-white focus-visible:ring-offset-forest",
  night: "bg-night text-white hover:bg-night/85",
  // Pill: a forma e o tamanho são da própria variante (o `size` não vale).
  busca: "h-12 rounded-full border border-line bg-white px-4 text-sm font-normal text-ink hover:border-ink",
  // Sem transição de cor: ligado/desligado troca na hora (com a transição de 150 ms da base, o fundo
  // passava por cinzas claros e a leitura logo após o toque dava rgb(248, 248, 248) em vez da tinta).
  chip:
    "h-10 rounded-full border border-line bg-white px-4 text-sm font-normal text-ink transition-none hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white",
  flutuante: "h-12 rounded-full bg-ink px-6 text-sm text-white shadow-flutuante hover:bg-night",
};

const PILL: ReadonlySet<Variant> = new Set(["busca", "chip", "flutuante"]);

const sizes: Record<Size, string> = {
  // Compacto (cabeçalho, linhas de lista): 40 px.
  sm: "h-10 px-4 text-sm",
  // Padrão: 52 px no celular, 56 px no computador.
  md: "h-13 px-4 text-sm sm:px-6 sm:text-[15px] lg:h-14",
  lg: "h-13 px-6 text-[15px] sm:px-8 sm:text-base lg:h-14",
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold leading-none tracking-tight transition-[background-color,border-color,color,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 active:translate-y-px [&_svg]:shrink-0";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

/** Classes do botão para elementos que não são <Button>/<ButtonLink> (ex.: <a> externo, <label>). */
export function buttonClasses({ variant = "primary", size = "md", className }: CommonProps = {}) {
  if (PILL.has(variant)) return cn(base, variants[variant], className);
  // Altura explícita de quem chama (ex.: "h-11" na barra fixa) vale em todas as larguras: tira o lg:h-14 do tamanho.
  const tamanho = className && /(^|\s)h-(\d|\[)/.test(className) ? sizes[size].replace(" lg:h-14", "") : sizes[size];
  // O tamanho vem antes da variante: terciário/destrutivo tiram a caixa (altura e recuo).
  return cn(base, tamanho, variants[variant], className);
}

/**
 * Marca para a varredura "um primário por tela" (Prompt 41): `data-cta="primary"` só no primário
 * (primary e os nomes antigos accent/gold); os demais botões padrão levam `data-cta=""`; o ghost, nenhum.
 * Um `<a>`/`<button>` com `buttonClasses()` de primário marca à mão: `data-cta={marcaCta("primary")}`.
 */
export function marcaCta(variant: Variant = "primary"): "primary" | "" | undefined {
  if (variant === "ghost") return undefined;
  return variant === "primary" || variant === "accent" || variant === "gold" ? "primary" : "";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={buttonClasses({ variant, size, className })} data-cta={marcaCta(variant)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: CommonProps & { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <Link href={href} className={buttonClasses({ variant, size, className })} data-cta={marcaCta(variant)} {...props} />;
}
