import { cn } from "@/lib/utils";

/*
  Ilustrações de marca para estados vazios e 404 (azul #1E63D0 + verde-limão #6CBE2A).
  Traço limpo, minimalista, com o motivo da "estrada" do símbolo. Sem texto.
*/

const grad = (id: string) => (
  <defs>
    <linearGradient id={id} x1="0" y1="120" x2="120" y2="0" gradientUnits="userSpaceOnUse">
      <stop stopColor="#143C8C" />
      <stop offset="0.55" stopColor="#1E63D0" />
      <stop offset="1" stopColor="#6CBE2A" />
    </linearGradient>
  </defs>
);

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn("h-28 w-28", className)} fill="none" aria-hidden role="img">
      {children}
    </svg>
  );
}

/** Mala + chave + estrada — favoritos/reservas vazias. */
export function EmptyTripIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      {grad("vn-i1")}
      <circle cx="60" cy="60" r="56" fill="#EEF4FF" />
      <path d="M30 86c14-30 46-30 60 0" stroke="url(#vn-i1)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
      <rect x="40" y="44" width="30" height="36" rx="6" fill="white" stroke="#1E63D0" strokeWidth="3" />
      <path d="M48 44v-6a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v6" stroke="#1E63D0" strokeWidth="3" />
      <circle cx="80" cy="52" r="7" fill="none" stroke="#6CBE2A" strokeWidth="3" />
      <path d="M85 57l9 9m-4-1l3 3m-6-6l3 3" stroke="#6CBE2A" strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

/** Prédio com "+" — proprietário sem imóveis. */
export function EmptyBuildingIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      {grad("vn-i2")}
      <circle cx="60" cy="60" r="56" fill="#F2FBE9" />
      <rect x="38" y="38" width="34" height="46" rx="4" fill="white" stroke="url(#vn-i2)" strokeWidth="3" />
      <path d="M46 48h6M58 48h6M46 58h6M58 58h6M46 68h6" stroke="#1E63D0" strokeWidth="3" strokeLinecap="round" />
      <circle cx="82" cy="44" r="11" fill="#6CBE2A" />
      <path d="M82 39v10M77 44h10" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

/** Lupa + estrada — busca sem resultado. */
export function EmptySearchIllustration({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      {grad("vn-i3")}
      <circle cx="60" cy="60" r="56" fill="#EEF4FF" />
      <circle cx="54" cy="54" r="18" fill="white" stroke="url(#vn-i3)" strokeWidth="3" />
      <path d="M44 58c4-8 12-8 18-2" stroke="#6CBE2A" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
      <path d="M68 68l14 14" stroke="#1E63D0" strokeWidth="4" strokeLinecap="round" />
    </Frame>
  );
}

/** Estrada que vira sem saída — 404. */
export function NotFoundIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={cn("h-40 w-full max-w-sm", className)} fill="none" aria-hidden role="img">
      {grad("vn-i4")}
      <path
        d="M20 100C60 100 60 40 100 40s40 40 80 40"
        stroke="url(#vn-i4)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="3 14"
      />
      <circle cx="180" cy="80" r="9" fill="none" stroke="#6CBE2A" strokeWidth="4" />
      <path d="M176 76l8 8m0-8l-8 8" stroke="#6CBE2A" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
