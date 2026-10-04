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
  href?: string;
  light?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="Viva Nomads">
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

function Wordmark({ light }: { light?: boolean }) {
  return (
    <span className="font-title text-[1.2rem] font-bold tracking-tight leading-none">
      <span style={{ color: light ? "#FFFFFF" : "#0A4FD6" }}>Viva</span>
      <span style={{ color: light ? "#8FD63A" : "#5DBB1E" }}>Nomads</span>
    </span>
  );
}
