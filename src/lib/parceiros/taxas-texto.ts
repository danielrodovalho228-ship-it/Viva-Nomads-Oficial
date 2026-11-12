/*
  E763 — /parceiros mostrava só "Gestor 4%" e o único "10%" era a taxa de serviço do parceiro (90/10): o leitor lia o 10%
  como a 2ª faixa do proprietário (12/10/8/6). Duas taxas diferentes, rotuladas de quem paga e sobre o quê. As faixas vêm
  da MESMA tabela da cobrança (faixaPorImoveisAtivos). Puro (node --test).
*/
import { faixaPorImoveisAtivos } from "../cobranca/regra.ts";

const pct = (t: number) => `${Math.round(t * 1000) / 10}%`.replace(".", ",");

/** "12% (1–2 imóveis), 10% (3–5), 8% (6–15), 6% (16–19)" — as faixas do PROPRIETÁRIO, sem a do Plano Gestor. */
export const FAIXAS_PROPRIETARIO_TEXTO = [1, 3, 6, 16]
  .map((n, i) => faixaPorImoveisAtivos(n))
  .map((f, i) => `${pct(f.taxa)} (${f.minImoveis}–${f.maxImoveis}${i === 0 ? " imóveis" : ""})`)
  .join(", ");

export const ROTULO_TAXA_PROPRIETARIO = `Taxa do proprietário, por contrato fechado: ${FAIXAS_PROPRIETARIO_TEXTO}.`;
export const ROTULO_TAXA_PARCEIRO = "Taxa do parceiro de serviço (fotografia, limpeza, mudança…): 10% sobre cada serviço contratado, a regra 90/10. É outra taxa, não a do proprietário.";
