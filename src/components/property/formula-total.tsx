import { partirFormula } from "@/lib/formula-estadia";

/**
 * E696 — a conta do total da estadia no cartão de preço, em linhas: uma parcela por linha e o total inteiro, numa linha
 * própria que não quebra no meio ("= R$ 6.376"), no computador e no celular.
 */
export function FormulaDoTotal({ conta, total, testid }: { conta: string; total?: string; testid: string }) {
  const f = partirFormula(conta, total);
  if (f.parcelas.length === 0 && !f.total) return null;
  return (
    <div className="mt-1 text-xs text-muted tabular-nums" data-testid={testid}>
      <div data-testid="formula-total">
        <ul>
          {f.parcelas.map((p, i) => (
            <li key={i}>{i === 0 ? p : `+ ${p}`}</li>
          ))}
        </ul>
        {f.total && (
          <p className="mt-1 whitespace-nowrap border-t border-line pt-1 text-sm font-semibold text-ink" data-testid="formula-total-valor">
            = {f.total}
          </p>
        )}
      </div>
    </div>
  );
}
