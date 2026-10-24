import Link from "next/link";
import type { NumeroFaixa } from "@/lib/admin/faixa-celular";

/**
 * E73 (QA 24/10): a faixa curta de números-chave no topo do /admin, só no celular. Cada número abre a lista que ele
 * conta (regra de 13/10). No computador não aparece: lá o número-herói e a lista "Agora" já estão à vista.
 */
export function FaixaNumerosCelular({ itens }: { itens: NumeroFaixa[] }) {
  return (
    <nav aria-label="Números-chave" className="mb-6 grid grid-cols-2 gap-2 lg:hidden" data-testid="admin-faixa-numeros">
      {itens.map((n) => (
        <Link
          key={n.chave}
          href={n.href}
          className="flex min-h-16 flex-col justify-center rounded-xl border border-line bg-white px-4 py-2 hover:border-forest"
          data-testid={`admin-faixa-${n.chave}`}
        >
          <span className="font-title text-xl font-semibold leading-tight text-ink tabular-nums">{n.valor}</span>
          <span className="text-xs text-muted">{n.rotulo}</span>
        </Link>
      ))}
    </nav>
  );
}
