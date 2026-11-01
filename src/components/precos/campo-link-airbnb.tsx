"use client";

/*
  E399-C — campo "Link do anúncio no Airbnb" do Passo 8, com a comparação do selo "Preço justo". Só aparece com a chave
  PRECO_JUSTO_COMPARADOR (desligada). A cotação é SIMULADA (cotacaoSimulada): nenhuma chamada ao Airbnb nem a
  fornecedor. O link fica só no rascunho.
*/
import { AlertTriangle, FlaskConical } from "lucide-react";
import { lerLinkAirbnb } from "@/lib/comparador-airbnb/link-airbnb";
import { compararComAirbnb, cotacaoSimulada, ROTULO_SIMULADO } from "@/lib/comparador-airbnb/comparador";
import { formatBRL } from "@/lib/utils";

export function CampoLinkAirbnb({ valor, onChange, totalMensal }: { valor: string; onChange: (v: string) => void; totalMensal: number }) {
  const link = lerLinkAirbnb(valor);
  const cot = link.ok ? cotacaoSimulada(link.id) : null;
  const comp = cot ? compararComAirbnb(totalMensal, cot) : null;
  return (
    <div className="rounded-xl border border-line p-4" data-testid="campo-link-airbnb">
      <label className="block text-sm font-semibold text-ink" htmlFor="link-airbnb">
        Link do anúncio no Airbnb <span className="font-normal text-muted">(opcional)</span>
      </label>
      <p className="mt-1 text-xs text-muted">Se o imóvel também está no Airbnb, a Viva compara os preços para o selo &quot;Preço justo&quot;.</p>
      <input
        id="link-airbnb"
        type="url"
        inputMode="url"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="airbnb.com.br/rooms/…"
        className="input mt-2"
        aria-invalid={!link.ok && !("vazio" in link) ? true : undefined}
        data-testid="link-airbnb"
      />
      {!link.ok && !("vazio" in link) && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600" role="alert" data-testid="link-airbnb-erro">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {link.erro}
        </p>
      )}
      {comp && cot && (
        <div className="mt-3 text-sm" data-testid="comparacao-airbnb" data-estado={comp.estado}>
          <p className="flex items-center gap-1 text-xs font-semibold text-muted" data-testid="comparacao-simulada">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" /> {ROTULO_SIMULADO}
          </p>
          <p className="mt-1 text-ink">No Airbnb: {formatBRL(cot.mensalTotal)}/mês.</p>
          {comp.estado === "justo" && <p className="text-forest">Preço justo: {formatBRL(comp.diferenca)} abaixo do Airbnb.</p>}
          {comp.estado === "acima" && <p className="text-ink">Sem selo: {formatBRL(comp.diferenca)} acima do Airbnb.</p>}
          {comp.estado === "sem_valor" && <p className="text-muted">Informe o valor mensal para comparar.</p>}
        </div>
      )}
    </div>
  );
}
