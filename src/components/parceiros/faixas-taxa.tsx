import { FAIXAS_TAXA_PARCERIA, REGRA_TAXA_PARCERIA, reais } from "@/config/taxa-parceria";

/** Tabela das 3 faixas da taxa de parceria (ordem 39cc7c00). Valores vêm da constante única. */
export function FaixasTaxaParceria({ titulo = "Taxa de parceria" }: { titulo?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-6" data-testid="faixas-taxa-parceria">
      <h3 className="font-title text-lg font-bold text-ink">{titulo}</h3>
      <ul className="mt-3 divide-y divide-line text-sm text-ink">
        {FAIXAS_TAXA_PARCERIA.map((f) => (
          <li key={f.rotulo} className="flex items-center justify-between gap-3 py-2">
            <span>{f.rotulo}</span>
            <strong>{reais(f.valor)}</strong>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">{REGRA_TAXA_PARCERIA}</p>
    </div>
  );
}
