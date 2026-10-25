"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MERCADO } from "@/config/planos";
import { brlTaxa, comissaoSobreContrato, pctTexto } from "@/lib/cobranca/regra";
import { precoSugerido, recebeAirbnb, recebeViva } from "@/lib/preco-justo";

/**
 * "Quanto você recebe" (ordem 4c74ac38, item 1): o dono informa quanto cobraria no Airbnb e vê o que recebe lá e na
 * Viva. Só recomendação — nunca obrigatório.
 * E140: os dois lados no MESMO período (os meses do simulador do Passo 8), com a conta aberta; o valor sugerido é
 * rotulado como EQUIVALÊNCIA (o valor mensal com que o líquido na Viva iguala o do Airbnb no período), não como preço.
 */
export function PrecoSugerido({
  aluguel,
  meses,
  taxa,
  onUsar,
  onAirbnbMensal,
}: {
  aluguel: number;
  meses: number;
  taxa: number;
  onUsar: (valor: number) => void;
  onAirbnbMensal?: (mensal: number) => void;
}) {
  const [airbnb, setAirbnb] = useState("");
  const total = Number(airbnb) || 0;
  const [aberto, setAberto] = useState(false);
  const m = Number.isFinite(meses) && meses >= 1 ? Math.floor(meses) : 0;
  const sugerido = m > 0 ? precoSugerido(total, m, taxa) : null;
  const periodo = `${m} ${m === 1 ? "mês" : "meses"}`;

  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="preco-sugerido">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="text-sm font-medium text-forest underline">
        Comparar com o Airbnb (opcional)
      </button>
      {aberto && (
        <div className="mt-3 space-y-3">
          <label className="block text-sm text-ink">
            Quanto você cobraria no Airbnb pelos mesmos {periodo} (R$, valor total)
            <CampoReais
              semPrefixo
              value={airbnb === "" ? null : Number(airbnb)}
              onChange={(v) => {
                setAirbnb(v == null ? "" : String(v));
                if (m > 0) onAirbnbMensal?.((v ?? 0) / m);
              }}
              className="input mt-1"
              placeholder="10300"
            />
          </label>
          {sugerido !== null && (
            <>
              <dl className="space-y-2 text-sm" data-testid="comparador-conta">
                <div>
                  <dt className="font-medium text-ink">No Airbnb, em {periodo}</dt>
                  <dd className="text-muted" data-testid="conta-airbnb">
                    {brlTaxa(total)} cobrados; a taxa do Airbnb ({pctTexto(MERCADO.airbnbTaxa)}) é {brlTaxa(Math.round(total * MERCADO.airbnbTaxa * 100) / 100)}.
                    Você recebe <strong className="text-ink" data-testid="recebe-airbnb">{brlTaxa(recebeAirbnb(total))}</strong>.
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-ink">Na Viva, em {periodo}, a {brlTaxa(sugerido)}/mês</dt>
                  <dd className="text-muted" data-testid="conta-viva">
                    {brlTaxa(sugerido)} × {m} = {brlTaxa(sugerido * m)} do morador, direto a você; a taxa de serviço ({pctTexto(taxa)} sobre o valor mensal × meses) é{" "}
                    {brlTaxa(comissaoSobreContrato(sugerido, m, taxa))}. Você recebe <strong className="text-ink" data-testid="recebe-viva">{brlTaxa(recebeViva(sugerido, m, taxa))}</strong>.
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted" data-testid="sugerido-equivalencia">
                <strong className="text-ink">{brlTaxa(sugerido)}/mês é uma equivalência</strong>: o valor mensal com que, em {periodo}, você recebe na Viva o mesmo
                que no Airbnb. Não é o preço da região. Guardamos o valor do Airbnb por mês só para o selo “Preço justo”. O valor é seu.
              </p>
              <Button type="button" size="sm" onClick={() => onUsar(sugerido)} disabled={aluguel === sugerido}>
                Usar {brlTaxa(sugerido)}/mês como valor mensal
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
