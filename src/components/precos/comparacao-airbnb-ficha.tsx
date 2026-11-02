/*
  E399-C, pacote 3 — o bloco da FICHA do anúncio com a comparação do selo "Preço justo" (só com a chave
  PRECO_JUSTO_COMPARADOR e só quando o anúncio tem o selo). Nunca mostra o link nem o número do anúncio no Airbnb.
*/
import { BadgePercent } from "lucide-react";
import { textoComparacaoFicha, type ComparacaoFicha } from "@/lib/comparador-airbnb/comparacao";

export function ComparacaoAirbnbFicha({ comparacao }: { comparacao: ComparacaoFicha }) {
  const t = textoComparacaoFicha(comparacao);
  return (
    <div className="mt-3 rounded-xl border border-sage-200 bg-sage-50 p-3 text-sm" data-testid="ficha-comparacao-airbnb" data-simulado={comparacao.simulado ? "1" : undefined}>
      <p className="flex items-start gap-2 font-semibold text-forest">
        <BadgePercent className="mt-1 h-4 w-4 shrink-0" aria-hidden /> Preço justo: {t.principal}
      </p>
      <p className="mt-1 text-xs text-muted">{t.detalhe}</p>
      {t.simulado && <p className="mt-1 text-xs text-muted" data-testid="ficha-comparacao-simulada">{t.simulado}</p>}
    </div>
  );
}
