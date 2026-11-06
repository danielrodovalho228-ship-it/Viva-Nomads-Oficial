/*
  E592/E594 (Frente B): a /simulacao (e o /roi, a mesma fonte) projetava com aluguel médio de R$ 4.320 e taxa média de
  12% (todos os contratos na 1ª faixa). O modelo validado usa aluguel médio de R$ 3.000 e taxa média de 10%. As lacunas de
  custo (o que ainda não tem preço: entra como R$ 0 ou como hipótese) passam a aparecer num quadro próprio, para que o
  resultado não pareça completo.
  Roda: node --test src/lib/financeiro/e592-premissas-validadas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALUGUEL_MEDIO, TAXA_MEDIA, MESES_MEDIOS_CONTRATO, LACUNAS_CUSTO, CUSTOS_FIXOS, CUSTOS_POR_CONTRATO } from "../../config/premissas-financeiras.ts";
import { taxaMediaPorContrato, receitaBrutaMensal } from "./projecao.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("receita: aluguel médio R$ 3.000 e taxa média 10% (modelo validado)", () => {
  assert.equal(ALUGUEL_MEDIO, 3000);
  assert.equal(TAXA_MEDIA, 0.1);
  assert.equal(taxaMediaPorContrato(), 3000 * MESES_MEDIOS_CONTRATO * 0.1); // R$ 900 com 3 meses
  assert.equal(receitaBrutaMensal(10), 9000);
});

test("lacunas: todo custo sem preço (R$ 0 'a cotar') ou hipotético está na lista, com a situação", () => {
  // Modelo v3: o marketing pago em R$ 0 é decisão (a linha existe), não falta de preço.
  const semPreco = [...CUSTOS_FIXOS, ...CUSTOS_POR_CONTRATO].filter((c) => c.valor === 0 && c.rotulo !== "Marketing pago").map((c) => c.rotulo);
  assert.ok(semPreco.length > 0);
  for (const r of semPreco) assert.ok(LACUNAS_CUSTO.some((l) => l.rotulo === r), `falta na lista de lacunas: ${r}`);
  assert.ok(LACUNAS_CUSTO.some((l) => /Identidade/.test(l.rotulo) && /hipótese/.test(l.situacao)), "a identidade (Certta) é hipótese");
  assert.ok(LACUNAS_CUSTO.some((l) => /WhatsApp/.test(l.rotulo)), "o WhatsApp fora do fixo");
  for (const l of LACUNAS_CUSTO) assert.ok(l.situacao.trim().length > 0, l.rotulo);
});

test("tela: a /simulacao mostra o quadro das lacunas e a taxa média do modelo validado (sem o mix de faixas)", () => {
  const s = ler("components/financeiro/modelo-financeiro.tsx");
  assert.match(s, /data-testid="lacunas-custo"/);
  assert.match(s, /LACUNAS_CUSTO\.map\(/);
  assert.doesNotMatch(s, /MIX_FAIXAS/);
});
