import { Check } from "lucide-react";
import { PAGAMENTO_EM_BREVE, REGRAS_CLARAS } from "@/lib/parceiros/regras";

/**
 * Regras claras dos parceiros (Prompt 31a, item 8): mensagens da Viva, taxa de serviço de 10% e a divisão na
 * origem. Com a chave PAGAMENTO_PARCEIROS_ATIVO desligada, avisa "Pagamento pela plataforma em breve."
 */
export function RegrasParceiros({ pagamentoAtivo, extra }: { pagamentoAtivo: boolean; extra?: string }) {
  return (
    <div data-testid="taxa-servico-parceiros">
      <ul className="space-y-3">
        {REGRAS_CLARAS.map((r) => (
          <li key={r} className="flex gap-3 text-ink">
            <Check className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
            <span>{r}</span>
          </li>
        ))}
        {extra && (
          <li className="flex gap-3 text-ink">
            <Check className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
            <span>{extra}</span>
          </li>
        )}
      </ul>
      {!pagamentoAtivo && (
        <p className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-semibold text-ink" data-testid="pagamento-em-breve">
          {PAGAMENTO_EM_BREVE}
        </p>
      )}
    </div>
  );
}
