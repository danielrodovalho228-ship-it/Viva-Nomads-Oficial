/*
  QA-LOGIN-B v2 — resumo diário da porta de QA ao Daniel (só informativo).
  Roda: node --test src/lib/qa/resumo-porta.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { avisoResumoPorta, chaveResumoPorta, diaDoResumo, janelaDoDia } from "./resumo-porta.ts";

test("o resumo é sempre do dia anterior (Brasília) e a janela cobre o dia inteiro em -03:00", () => {
  assert.equal(diaDoResumo(new Date("2026-10-29T13:00:00Z")), "2026-10-28");
  assert.equal(diaDoResumo(new Date("2026-10-29T02:00:00Z")), "2026-10-27", "23h de 28/10 em Brasília → resumo de 27/10");
  assert.deepEqual(janelaDoDia("2026-10-28"), { de: "2026-10-28T03:00:00.000Z", ate: "2026-10-29T03:00:00.000Z" });
  assert.equal(chaveResumoPorta("2026-10-28"), "porta-qa:resumo:2026-10-28");
});

test("sem entrada do admin observador, nada; com entradas, P3 informativo com hora e caminho, sem dado pessoal", () => {
  assert.equal(avisoResumoPorta("2026-10-28", []), null);
  const a = avisoResumoPorta("2026-10-28", [
    { criado_em: "2026-10-28T13:05:00Z", destino: "/admin" },
    { criado_em: "2026-10-28T18:40:00Z", destino: null },
  ])!;
  assert.equal(a.prioridade, "P3");
  assert.equal(a.assunto, "Porta de QA: 2 entradas do admin observador em 28/10");
  assert.match(a.corpo, /Só informativo, nenhuma ação exigida/);
  assert.match(a.corpo, /10:05 → \/admin/);
  assert.match(a.corpo, /15:40 → \/dashboard/);
  assert.doesNotMatch(a.corpo, /@|ip|chave=/i);
  assert.ok(a.corpo.length <= 1000);
});
