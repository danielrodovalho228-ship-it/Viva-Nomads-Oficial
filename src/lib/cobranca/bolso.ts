import { comissaoSobreContrato, faixaPorImoveisAtivos, pctTexto } from "./regra.ts";

/*
  "O que vai para o seu bolso" (ordem 6696611c, tela 10). Só monta a conta; a fórmula é a ÚNICA de regra.ts
  (comissaoSobreContrato) e as faixas vêm de FAIXAS_COMISSAO_PADRAO. 31+ imóveis = Plano Gestor: sem valor
  calculado, "fale com a Viva".

  Adendo do #851 (a Viva só intermedia, não segura pagamentos): o resultado sai em 3 blocos SEPARADOS — o que o morador
  paga ao dono (integral, direto a ele), a taxa da Viva (cobrada à parte, só com contrato fechado) e o resultado no
  período. A taxa nunca aparece descontada do valor do morador: nada de "fica com você", sinal de menos ou "do total".
*/

export const NOTA_BOLSO = "A taxa só é cobrada com contrato fechado. Anúncio grátis. O morador paga direto a você.";

export type Bolso =
  | { estado: "invalido" }
  | { estado: "gestor"; recebe: number }
  | { estado: "ok"; recebe: number; taxa: number; taxaTexto: string; valorTaxa: number; resultado: number };

export function calcularBolso(valorMensal: number, meses: number, imoveis: number): Bolso {
  if (!Number.isFinite(valorMensal) || valorMensal <= 0) return { estado: "invalido" };
  if (!Number.isFinite(meses) || meses < 1) return { estado: "invalido" };
  if (!Number.isFinite(imoveis) || imoveis < 1) return { estado: "invalido" };
  const recebe = Math.round(valorMensal * Math.floor(meses) * 100) / 100;
  const faixa = faixaPorImoveisAtivos(imoveis);
  if (faixa.gestor) return { estado: "gestor", recebe };
  const valorTaxa = comissaoSobreContrato(valorMensal, meses, faixa.taxa);
  return {
    estado: "ok",
    recebe,
    taxa: faixa.taxa,
    taxaTexto: pctTexto(faixa.taxa),
    valorTaxa,
    resultado: Math.round((recebe - valorTaxa) * 100) / 100,
  };
}

const brl0 = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v).replace(/\u00a0/g, " ");

export interface BlocoBolso {
  rotulo: string;
  valor: string;
  detalhe: string | null;
}

/**
 * Os 3 blocos do resultado (adendo do #851), com o exemplo aprovado pelo Muse (R$ 3.000 × 4, 1 imóvel):
 *  1. "Você recebe do morador" — R$ 12.000 — "integral, direto a você";
 *  2. "Taxa de serviço da Viva" — R$ 1.440 — "12% sobre o valor mensal × meses (R$ 3.000 × 4). Cobrada à parte, só com
 *     contrato fechado";
 *  3. "Seu resultado no período" — R$ 10.560.
 */
export function blocosBolso(b: Extract<Bolso, { estado: "ok" }>, valorMensal: number, meses: number): [BlocoBolso, BlocoBolso, BlocoBolso] {
  return [
    { rotulo: "Você recebe do morador", valor: brl0(b.recebe), detalhe: "integral, direto a você" },
    {
      rotulo: "Taxa de serviço da Viva",
      valor: brl0(b.valorTaxa),
      detalhe: `${b.taxaTexto} sobre o valor mensal × meses (${brl0(valorMensal)} × ${Math.floor(meses)}). Cobrada à parte, só com contrato fechado`,
    },
    { rotulo: "Seu resultado no período", valor: brl0(b.resultado), detalhe: null },
  ];
}
