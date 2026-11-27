import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cal = readFileSync("src/components/property/availability-calendar.tsx", "utf8");

// E713 (QA, R1 sobre o E694): no anúncio de exemplo a seleção de datas abria um resumo com o aviso "esta solicitação não é
// enviada" e nenhum botão — a pessoa escolhia as datas e não tinha para onde ir. O aviso morto dá lugar à explicação
// (as datas só simulam o valor) e à saída "Ver imóveis reais", a mesma do cartão de preço (E694).
test("no exemplo, sob a seleção de datas há a explicação e o 'Ver imóveis reais', não o aviso morto", () => {
  const i = cal.indexOf("isDemo ? (");
  assert.ok(i > 0);
  const bloco = cal.slice(i, i + 1200);
  assert.doesNotMatch(bloco, /esta solicitação não é enviada/);
  assert.match(bloco, /data-testid="calendario-exemplo"/);
  assert.match(bloco, /simular/);
  assert.match(bloco, /href="\/buscar"[^>]*data-testid="calendario-exemplo-ver-reais"/);
});
