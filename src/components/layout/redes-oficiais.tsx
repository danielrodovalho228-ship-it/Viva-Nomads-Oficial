import { REDES_OFICIAIS } from "@/config/redes";

/** Ícone do Instagram (contorno). A lucide-react 1.x não traz ícones de marca. */
function IconeInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

/** "@vivanomads" a partir da URL (só para o texto visível). */
function arroba(url: string): string {
  const m = url.match(/instagram\.com\/([^/?#]+)/i);
  return m ? `@${m[1]}` : url;
}

/**
 * Links das redes OFICIAIS (src/config/redes.ts — Prompt 35A, item 4). Sempre `rel="noopener"`, nova aba e nome
 * acessível no link do ícone. `comTexto` mostra "@conta" ao lado do ícone (Central de Ajuda); sem ele, só o ícone
 * (rodapé).
 */
export function RedesOficiais({ comTexto = false, className = "", linkClassName = "" }: { comTexto?: boolean; className?: string; linkClassName?: string }) {
  if (!REDES_OFICIAIS.length) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-3 ${className}`} data-testid="redes-oficiais">
      {REDES_OFICIAIS.map((r) => (
        <li key={r.url}>
          <a
            href={r.url}
            target="_blank"
            rel="noopener"
            aria-label={`${r.nome}${comTexto ? ` ${arroba(r.url)}` : ""} da Viva Nomads (abre em nova aba)`}
            className={`inline-flex min-h-10 items-center gap-2 ${linkClassName}`}
          >
            {r.nome === "Instagram" ? <IconeInstagram className="h-5 w-5 shrink-0" /> : null}
            {comTexto ? <span>{arroba(r.url)}</span> : r.nome !== "Instagram" ? <span>{r.nome}</span> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
