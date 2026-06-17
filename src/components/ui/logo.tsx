import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo Viva Nomads.
 * Wordmark interino (Viva azul + Nomads verde) e símbolo "N" com gradiente
 * azul→verde. Estruturado para troca direta pelos arquivos oficiais:
 * basta substituir os SVGs de <BrandMark/> e <Wordmark/>.
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

/** Símbolo "N" (monograma com estrada) — também usado em favicon/app icon. */
export function BrandMark({ size = 30 }: { size?: number }) {
  const id = "vn-grad";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="4" y1="36" x2="36" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#143C8C" />
          <stop offset="0.5" stopColor="#1E63D0" />
          <stop offset="1" stopColor="#6CBE2A" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill={`url(#${id})`} />
      {/* "N" estilizado como estrada */}
      <path
        d="M13 28V14.5C13 13 14.8 12.4 15.7 13.6L24.3 26.4C25.2 27.6 27 27 27 25.5V12"
        stroke="white"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Wordmark({ light }: { light?: boolean }) {
  return (
    <span className="font-title text-[1.15rem] font-extrabold tracking-tight leading-none">
      <span style={{ color: light ? "#5fa3ff" : "#1E63D0" }}>Viva</span>
      <span style={{ color: "#6CBE2A" }}>Nomads</span>
    </span>
  );
}
