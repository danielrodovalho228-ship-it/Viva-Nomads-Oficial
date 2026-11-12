import { test, expect } from "@playwright/test";
import { estadiaNoCartao } from "../../../src/lib/cartao-estadia";
import { estadiaDoImovel } from "../../../src/lib/precos";
import { SAMPLE_PROPERTIES } from "../../../src/lib/properties";

/*
  T1581 — E756 (#3557): o total "em N meses" do cartão da busca é EXATAMENTE o da página do imóvel e diz o que inclui (ube-003, 2 meses:
  2 x R$ 4.100 + preparação R$ 450 + saída R$ 250 = R$ 8.900). Só lógica, roda no lab-crítico.
*/
test("E756: ube-003 em 2 meses = R$ 8.900, com a composição dita", () => {
  const p = SAMPLE_PROPERTIES.find((x) => x.id === "ube-003")!;
  const c = estadiaNoCartao(p, 2)!;
  expect(c.total).toBe(8900);
  expect(c.composicao).toBe("Inclui limpeza de preparação e limpeza de saída");
});

test("E756: para todos os exemplos e 2, 3, 4 e 6 meses o cartão e a página somam o mesmo", () => {
  for (const p of SAMPLE_PROPERTIES) for (const m of [2, 3, 4, 6]) expect(estadiaNoCartao(p, m)?.total ?? null, `${p.id} em ${m} meses`).toBe(estadiaDoImovel(p, m)?.total ?? null);
});
