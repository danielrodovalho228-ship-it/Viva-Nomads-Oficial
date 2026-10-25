"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TAXA_COMISSAO_PADRAO, pctTexto } from "@/lib/cobranca/regra";
import { taxaDoMeuNovoAnuncio } from "@/lib/preco-justo-actions";
import { economiaDoMorador, precoSugerido, recebeAirbnb, recebeViva } from "@/lib/preco-justo";

const MESES = 2;
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * "Quanto você recebe" (ordem 4c74ac38, item 1): o dono informa quanto cobraria no Airbnb por 2 meses e vê
 * o que recebe lá e na Viva. Só recomendação — nunca obrigatório.
 */
export function PrecoSugerido({ aluguel, onUsar, onAirbnbMensal }: { aluguel: number; onUsar: (valor: number) => void; onAirbnbMensal?: (mensal: number) => void }) {
  const [airbnb, setAirbnb] = useState("");
  const total = Number(airbnb) || 0;
  const [taxa, setTaxa] = useState(TAXA_COMISSAO_PADRAO);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    let vivo = true;
    taxaDoMeuNovoAnuncio().then((t) => vivo && setTaxa(t)).catch(() => {});
    return () => { vivo = false; };
  }, []);
  const sugerido = precoSugerido(total, MESES, taxa);

  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="preco-sugerido">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="text-sm font-medium text-forest underline">
        Comparar com o Airbnb (opcional)
      </button>
      {aberto && (
        <div className="mt-3 space-y-2">
          <label className="block text-sm text-ink">
            Quanto você cobraria no Airbnb por {MESES} meses (R$)
            <CampoReais semPrefixo value={airbnb === "" ? null : Number(airbnb)} onChange={(v) => { setAirbnb(v == null ? "" : String(v)); onAirbnbMensal?.((v ?? 0) / MESES); }} className="input mt-1" placeholder="10300" />
          </label>
          {sugerido !== null && (
            <>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>No Airbnb você recebe</dt><dd data-testid="recebe-airbnb">{brl(recebeAirbnb(total))}</dd></div>
                <div className="flex justify-between"><dt>Na Viva, a {brl(sugerido)}/mês, você recebe</dt><dd data-testid="recebe-viva">{brl(recebeViva(sugerido, MESES, taxa))}</dd></div>
              </dl>
              <p className="text-xs text-muted">
                Guardamos esse valor (por mês) só para o selo “Preço justo”, quando o seu valor mensal ficar abaixo dele. Taxa de {pctTexto(taxa)} (a da sua faixa de imóveis) sobre o valor total do contrato, só no fechamento.
                {economiaDoMorador(total, sugerido, MESES).reais > 0 && " O morador paga menos que no Airbnb."} É só uma sugestão: o valor é seu.
              </p>
              <Button type="button" size="sm" onClick={() => onUsar(sugerido)} disabled={aluguel === sugerido}>
                Usar preço sugerido
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
