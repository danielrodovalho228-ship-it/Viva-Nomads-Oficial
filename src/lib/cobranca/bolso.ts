import { brlTaxa, comissaoSobreContrato, faixaPorImoveisAtivos, pctTexto } from "./regra.ts";
import { parcelasDoMes, type ContaPeriodo } from "../precos.ts";

/*
  "O que vai para o seu bolso" (ordem 6696611c, tela 10). Só monta a conta; a fórmula é a ÚNICA de regra.ts
  (comissaoSobreContrato) e as faixas vêm de FAIXAS_COMISSAO_PADRAO. 31+ imóveis = Plano Gestor: sem valor
  calculado, "fale com a Viva".

  Adendo do #851 e E51 (a Viva só intermedia, não segura pagamentos): a tela mostra DOIS FATOS SEPARADOS — o que o
  morador paga ao dono (integral, direto a ele) e a taxa da Viva (cobrada à parte, só com contrato fechado). Sem linha de
  "resultado" (recebe − taxa): a subtração lia como a Viva retendo ou compensando valores. A taxa nunca aparece descontada
  do valor do morador: nada de "fica com você", "resultado", sinal de menos ou "do total".
*/

export const NOTA_BOLSO = "A taxa só é cobrada com contrato fechado. Anúncio grátis. O morador paga direto a você.";

export type Bolso =
  | { estado: "invalido" }
  | { estado: "gestor"; recebe: number }
  | { estado: "ok"; recebe: number; taxa: number; taxaTexto: string; valorTaxa: number };

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
 * E139 — os 2 fatos no Passo 8 do cadastro, pela conta do período (contaDoPeriodo): o morador paga o total do mês
 * COM condomínio e contas × meses, direto ao dono; a taxa é sobre o valor mensal × meses, com a conta aberta.
 * Exemplo do E139 (3.600 + 350 + 150, 4 meses, 12%): R$ 16.400 e R$ 1.728 (R$ 3.600 × 4 = R$ 14.400).
 * A frase "só com contrato fechado" fica só na NOTA_BOLSO (E151: cada explicação uma vez).
 */
export function blocosBolsoPeriodo(c: ContaPeriodo): [BlocoBolso, BlocoBolso] {
  const mesmoMes = c.mes.total === c.mes.aluguel;
  const porMes = mesmoMes ? `${brlTaxa(c.mes.aluguel)}/mês` : `${brlTaxa(c.mes.total)}/mês (${parcelasDoMes(c.mes).replace(/ /g, " ")})`;
  return [
    { rotulo: "Você recebe do morador", valor: brlTaxa(c.totalMorador), detalhe: `${porMes} × ${c.meses}, direto a você` },
    {
      rotulo: "Taxa de serviço da Viva",
      valor: brlTaxa(c.valorTaxa),
      detalhe: `${pctTexto(c.taxa)} sobre o valor mensal × meses (${brlTaxa(c.mes.aluguel)} × ${c.meses} = ${brlTaxa(c.baseTaxa)})${mesmoMes ? "" : ". Condomínio e contas não entram na taxa"}`,
    },
  ];
}

/**
 * Os 2 fatos (E51), com o exemplo aprovado (R$ 3.000 × 4, 1 imóvel):
 *  1. "Você recebe do morador" — R$ 12.000 — "integral e direto a você";
 *  2. "Taxa de serviço da Viva" — R$ 1.440 — "12% sobre o valor mensal × meses (R$ 3.000 × 4). Cobrada à parte, só com
 *     contrato fechado".
 */
export function blocosBolso(b: Extract<Bolso, { estado: "ok" }>, valorMensal: number, meses: number): [BlocoBolso, BlocoBolso] {
  return [
    { rotulo: "Você recebe do morador", valor: brl0(b.recebe), detalhe: "integral e direto a você" },
    {
      rotulo: "Taxa de serviço da Viva",
      valor: brl0(b.valorTaxa),
      detalhe: `${b.taxaTexto} sobre o valor mensal × meses (${brl0(valorMensal)} × ${Math.floor(meses)}). Cobrada à parte, só com contrato fechado`,
    },
  ];
}
