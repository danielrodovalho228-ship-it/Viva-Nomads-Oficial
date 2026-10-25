import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo Viva Nomads (oficial, 2026): símbolo "N" azul e verde + wordmark
 * "VivaNomads" ("Viva" azul #0A4FD6, "Nomads" verde #5DBB1E).
 *
 * O símbolo é o arquivo oficial (PNG com fundo transparente) em
 * public/brand/novo/ — vn-mark-128.png até 64 px, vn-mark-512.png acima.
 * Na versão `light` (barra lateral escura), o símbolo ganha um quadrado branco
 * de cantos 8 px para o azul continuar legível, e o wordmark fica branco/verde.
 */
export function Logo({
  href = "/",
  light = false,
  className,
}: {
  /** null = só a marca, sem link (CADASTRO-MOLDURA: no assistente o logo não tira ninguém do fluxo). */
  href?: string | null;
  light?: boolean;
  className?: string;
}) {
  if (href === null)
    return (
      <span className={cn("inline-flex items-center gap-2", className)} aria-label="VivaNomads" role="img" data-logo>
        <BrandMark onDark={light} />
        <Wordmark light={light} />
      </span>
    );
  return (
    // O nome acessível CONTÉM o texto visível ("VivaNomads"): axe label-content-name-mismatch (t251).
    <Link href={href} className={cn("inline-flex items-center gap-2", className)} aria-label="VivaNomads — página inicial" data-logo>
      <BrandMark onDark={light} />
      <Wordmark light={light} />
    </Link>
  );
}

/** Símbolo "N" — o mesmo do favicon e dos ícones do app. */
export function BrandMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  const src = size > 64 ? "/brand/novo/vn-mark-512.png" : "/brand/novo/vn-mark-128.png";
  const img = <Image src={src} width={size} height={size} alt="" priority aria-hidden />;
  if (!onDark) return img;
  // Fundo escuro: placa branca atrás do símbolo (o azul some sobre o verde-escuro).
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-lg bg-white"
      style={{ width: size + 8, height: size + 8 }}
    >
      {img}
    </span>
  );
}

/** Verde da marca (#5DBB1E) tem só 2,4:1 sobre branco; o texto sobre fundo claro usa um tom mais escuro (≥ 4,5:1, axe color-contrast). */
export const VERDE_WORDMARK_SOBRE_CLARO = "#357A0E";

function Wordmark({ light }: { light?: boolean }) {
  return (
    <span className="font-title text-[1.2rem] font-semibold tracking-tight leading-none">
      <span style={{ color: light ? "#FFFFFF" : "#0A4FD6" }}>Viva</span>
      <span style={{ color: light ? "#8FD63A" : VERDE_WORDMARK_SOBRE_CLARO }}>Nomads</span>
    </span>
  );
}
