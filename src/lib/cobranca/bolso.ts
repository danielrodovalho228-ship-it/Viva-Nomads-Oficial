import { comissaoSobreContrato, faixaPorImoveisAtivos, pctTexto } from "./regra.ts";

/*
  "O que vai para o seu bolso" (ordem 6696611c, tela 10). Só monta a conta; a fórmula é a ÚNICA de regra.ts
  (comissaoSobreContrato) e as faixas vêm de FAIXAS_COMISSAO_PADRAO. 31+ imóveis = Plano Gestor: sem valor
  calculado, "fale com a Viva".
*/

export const NOTA_BOLSO = "A taxa só é cobrada com contrato fechado. Anúncio grátis. O morador paga direto a você.";

export type Bolso =
  | { estado: "invalido" }
  | { estado: "gestor"; recebe: number }
  | { estado: "ok"; recebe: number; taxa: number; taxaTexto: string; valorTaxa: number; fica: number };

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
    fica: Math.round((recebe - valorTaxa) * 100) / 100,
  };
}
