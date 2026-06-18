import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo Viva Nomads (oficial): símbolo "N" com estrada (azul + verde) + wordmark
 * "VivaNomads" (Viva azul #1E63D0, Nomads verde #6CBE2A).
 *
 * Esta é a interpretação vetorial do logo oficial. Para fidelidade pixel-perfect,
 * basta soltar os arquivos em public/brand/ e trocar por <Image/> (ver ASSETS.md).
 */
export function Logo({
  href = "/home",
  light = false,
  className,
}: {
  href?: string;
  light?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="Viva Nomads">
      <BrandMark />
      <Wordmark light={light} />
    </Link>
  );
}

/** Símbolo "N" com estrada — também usado em favicon/app icon. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      <defs>
        <linearGradient id="vn-blue" x1="20" y1="86" x2="70" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#143C8C" />
          <stop offset="1" stopColor="#2E8BE6" />
        </linearGradient>
        <linearGradient id="vn-green" x1="66" y1="86" x2="86" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4FA01E" />
          <stop offset="1" stopColor="#8FD63A" />
        </linearGradient>
      </defs>
      {/* perna esquerda + diagonal (azul) formando o N */}
      <path d="M16 14h17v72H16z" fill="url(#vn-blue)" />
      <path d="M19 14h17l48 72H67z" fill="url(#vn-blue)" />
      {/* perna direita (verde) com curva inferior */}
      <path d="M67 14h17v60c0 7-4 12-11 12h-6z" fill="url(#vn-green)" />
      {/* estrada com perspectiva (faixas brancas) */}
      <path d="M37 86l13-22" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M47 86l8-18" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 6" />
    </svg>
  );
}

function Wordmark({ light }: { light?: boolean }) {
  return (
    <span className="font-title text-[1.2rem] font-bold tracking-tight leading-none">
      <span style={{ color: light ? "#4f9bff" : "#1E63D0" }}>Viva</span>
      <span style={{ color: light ? "#8FD63A" : "#6CBE2A" }}>Nomads</span>
    </span>
  );
}
