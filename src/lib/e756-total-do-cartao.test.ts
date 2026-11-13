// E756: o cartão mostrava "R$ 8.200 em 2 meses" (2 × o total do mês) para uma casa cuja página soma 2 × R$ 4.100 + R$ 450 + R$ 250 = R$ 8.900.
// Agora o total do cartão é o da página e o cartão diz o que inclui; sem limpezas, o total é só mensalidades e não há linha de composição.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadiaNoCartao } from "./cartao-estadia.ts";
import { estadiaDoImovel } from "./precos.ts";
import { SAMPLE_PROPERTIES } from "./properties.ts";

const ube003 = SAMPLE_PROPERTIES.find((p) => p.id === "ube-003")!;

test("E756: ube-003 (2 meses): R$ 8.900 = 2 × R$ 4.100 + preparação R$ 450 + saída R$ 250, com a composição dita no cartão", () => {
  const c = estadiaNoCartao(ube003, 2)!;
  assert.equal(c.total, 8900);
  assert.match(c.texto.replace(/\s/g, " "), /R\$ 8\.900.* em 2 meses/);
  // E756 (reprovado ao vivo em 11/11/2026, devolvido à Pista B; vigia 12/11: regra única de composição em todas as superfícies): o cartão mostra a CONTA aberta (antes, "Inclui limpeza de preparação e limpeza de saída", sem valores).
  assert.equal(c.composicao.replace(/\u00a0/g, " "), "2 × R$ 4.100 + limpeza de preparação R$ 450 + limpeza de saída R$ 250");
});

test("E756: o total do cartão é EXATAMENTE o da página do imóvel, para todos os exemplos e para 2 a 6 meses", () => {
  for (const p of SAMPLE_PROPERTIES) {
    for (const m of [2, 3, 4, 6]) {
      const cartao = estadiaNoCartao(p, m);
      const pagina = estadiaDoImovel(p, m);
      assert.equal(cartao?.total ?? null, pagina?.total ?? null, `${p.id} em ${m} meses`);
    }
  }
});

// E756 (reprovado ao vivo em 11/11/2026, devolvido à Pista B; vigia 12/11: regra única de composição em todas as superfícies): antes, com 1 mês o cartão não tinha total da estadia (caía no total do MÊS, sem as limpezas) e, sem limpezas, não dizia a
// composição. Agora: com 1 mês, o mesmo total da página (com as limpezas); sem limpezas, a conta diz só as mensalidades.
test("E756: com 1 mês o total é o da regra única (com as limpezas); sem limpezas a conta diz só as mensalidades", () => {
  assert.equal(estadiaNoCartao(ube003, 1)?.total, 4800, "1 × R$ 4.100 + R$ 450 + R$ 250");
  const semLimpeza = { ...ube003, prepFee: 0, checkoutCleaningEnabled: false, checkoutCleaningFee: 0 };
  const c = estadiaNoCartao(semLimpeza, 2)!;
  assert.equal(c.composicao.replace(/\u00a0/g, " "), "2 × R$ 4.100");
  assert.equal(c.total, 8200);
});

// E899 (asserção alterada, decisão do Daniel de 13/11): o cartão desenha do modeloDoCartao, cujo total da estadia vem de estadiaNoCartao
// (o total da página); a composição saiu do cartão e mora na página. Antes: o cartão chamava estadiaNoCartao direto e desenhava a conta.
test("E756 + E899: o cartão da busca usa o total da página (pelo modelo) e não desenha a composição", async () => {
  const card = readFileSync("src/components/property-card.tsx", "utf8");
  assert.match(card, /const modelo = modeloDoCartao\(property, mesesDoCartao\(periodMonths, property\.minPeriodDays\)\)/);
  assert.match(card, /\{modelo\.totalEstadia\.texto\}/);
  assert.doesNotMatch(card, /cartao-total-composicao/);
  const modelo = readFileSync("src/lib/cartao-modelo.ts", "utf8");
  assert.match(modelo, /const estadia = estadiaNoCartao\(p, n\)/);
});
