/*
  Preço "tudo incluído" — FONTE ÚNICA da verdade (corrige a divergência do E2E:
  o card somava aluguel + consumo e a página do imóvel somava aluguel + condomínio
  + consumo, exibindo valores diferentes para o mesmo imóvel).

  Regra: "tudo incluído" = ALUGUEL + CONDOMÍNIO + CONSUMO FIXO estimado.
  - condomínio: entra sempre que houver (custo mensal recorrente do imóvel).
  - consumo: só quando o regime é "fixo" (valor estimado no contrato); no regime
    "medido" o consumo é variável e não entra no número exibido.

  Pura e client-safe: usada pelo card da busca, pela página do imóvel e por
  qualquer outra superfície — todas convergem para o mesmo valor.
*/

import type { Property } from "@/lib/types";
import { formatBRL } from "./utils.ts";

export interface TudoIncluido {
  aluguel: number;
  condominio: number;
  consumoFixo: number; // 0 quando o regime é "medido"
  total: number; // aluguel + condominio + consumoFixo
  temExtras: boolean; // total > aluguel (há condomínio e/ou consumo fixo)
}

/** Calcula o "tudo incluído" mensal de um imóvel (fonte única). */
export function calcularTudoIncluido(property: Property): TudoIncluido {
  const aluguel = property.monthlyPrice ?? 0;
  const condominio = property.condoFee ?? 0;
  const consumoFixo =
    property.utilitiesMode === "fixed" ? property.utilitiesEstimate ?? 0 : 0;
  const total = aluguel + condominio + consumoFixo;
  return { aluguel, condominio, consumoFixo, total, temExtras: total > aluguel };
}

/** Total "tudo incluído" × meses (para o total do período na busca). */
export function totalPeriodo(property: Property, meses: number): number {
  return calcularTudoIncluido(property).total * Math.max(0, Math.floor(meses));
}

/*
  CUSTO TOTAL DO MÊS (ordem 1a555bfa) — a mesma conta na página do imóvel, no cartão
  da busca/home e na barra fixa do celular. O total é o mesmo de calcularTudoIncluido.
  Pagamentos únicos (preparação, limpeza de saída) ficam FORA do total; IPTU não
  existe no cadastro, então o texto avisa que não está incluso.
*/
export interface LinhaTotalMensal {
  chave: "mensal" | "condominio" | "contas" | "viva";
  rotulo: string;
  valor: number;
  /** Contas fixas são estimativa combinada no contrato. */
  estimativa?: boolean;
}

export interface PagamentoUnico {
  chave: "preparacao" | "saida";
  rotulo: string;
  valor: number;
}

export interface TotalMensal {
  total: number;
  linhas: LinhaTotalMensal[];
  unicos: PagamentoUnico[];
  /** Regime "real": o consumo é medido e não entra no total. */
  contasMedidas: boolean;
  iptuNaoIncluso: true;
}

const positivo = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

export function calcularTotalMensal(property: Property): TotalMensal {
  const inc = calcularTudoIncluido(property);
  const linhas: LinhaTotalMensal[] = [{ chave: "mensal", rotulo: "Valor mensal", valor: inc.aluguel }];
  if (positivo(inc.condominio)) linhas.push({ chave: "condominio", rotulo: "Condomínio", valor: inc.condominio });
  if (positivo(inc.consumoFixo)) {
    linhas.push({ chave: "contas", rotulo: "Água, luz e gás (estimativa)", valor: inc.consumoFixo, estimativa: true });
  }
  linhas.push({ chave: "viva", rotulo: "Taxa da Viva para você", valor: 0 });
  const unicos: PagamentoUnico[] = [];
  if (positivo(property.prepFee)) unicos.push({ chave: "preparacao", rotulo: "Limpeza de preparação", valor: property.prepFee });
  if (property.checkoutCleaningEnabled && positivo(property.checkoutCleaningFee)) {
    unicos.push({ chave: "saida", rotulo: "Limpeza de saída", valor: property.checkoutCleaningFee });
  }
  return {
    total: inc.total,
    linhas,
    unicos,
    contasMedidas: property.utilitiesMode !== "fixed",
    iptuNaoIncluso: true,
  };
}

/** Textos do cartão: total em destaque e o detalhe menor embaixo. */
export function textosTotalMensal(property: Property): { destaque: string; detalhe: string } {
  const t = calcularTotalMensal(property);
  const extras: string[] = [];
  if (t.linhas.some((l) => l.chave === "condominio")) extras.push("condomínio");
  if (t.linhas.some((l) => l.chave === "contas")) extras.push("contas");
  let detalhe = `Valor mensal ${formatBRL(t.linhas[0].valor)}`;
  if (extras.length > 0) detalhe += ` + ${extras.join(" e ")}`;
  else if (t.contasMedidas) detalhe += " + consumo medido";
  return { destaque: `${formatBRL(t.total)}/mês total`, detalhe };
}
