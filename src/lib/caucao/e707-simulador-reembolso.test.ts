/*
  E707 (resíduo) — o simulador /dashboard/reembolsos contava 30 dias a partir do CLIQUE. Com CAUCAO_PRAZOS_ATIVA ligada, o teto
  externo conta do check-out confirmado (o mesmo marco de prazos.ts), pedido na tela, e o texto diz que a devolução é devida de
  imediato nos casos sem desconto. Com a chave desligada, nada muda.
  Roda: node --test src/lib/caucao/e707-simulador-reembolso.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prazoLimiteDoReembolso, tetoExternoDevolucao } from "../caucao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E707 simulador: chave desligada = 30 dias a partir de hoje (como antes)", () => {
  assert.equal(prazoLimiteDoReembolso({ prazosAtivos: false, hoje: "2026-11-07", checkout: "2026-10-01" }), "2026-12-07");
  assert.equal(prazoLimiteDoReembolso({ prazosAtivos: false, hoje: "2026-11-07", checkout: "" }), "2026-12-07");
});

test("E707 simulador: chave ligada = teto externo do check-out; sem check-out informado, nenhum prazo", () => {
  assert.equal(prazoLimiteDoReembolso({ prazosAtivos: true, hoje: "2026-11-07", checkout: "2026-10-01" }), tetoExternoDevolucao("2026-10-01"));
  assert.equal(prazoLimiteDoReembolso({ prazosAtivos: true, hoje: "2026-11-07", checkout: "2026-10-01" }), "2026-10-31");
  assert.equal(prazoLimiteDoReembolso({ prazosAtivos: true, hoje: "2026-11-07", checkout: "" }), null);
  assert.equal(prazoLimiteDoReembolso({ prazosAtivos: true, hoje: "2026-11-07", checkout: "lixo" }), null);
});

test("E707 simulador: a tela lê a chave, pede o check-out e usa o marco único", () => {
  const p = ler("src/app/(dashboard)/dashboard/reembolsos/page.tsx");
  assert.match(p, /import \{ CAUCAO_PRAZOS_ATIVA \} from "@\/lib\/flags";/);
  assert.match(p, /prazoLimiteDoReembolso\(\{ prazosAtivos: CAUCAO_PRAZOS_ATIVA, hoje: hojeISO, checkout \}\)/);
  assert.match(p, /data-testid="reembolso-checkout"/);
  assert.match(p, /devida de imediato/);
  assert.doesNotMatch(p, /Date\.now\(\) \+ PRAZO_REEMBOLSO_DIAS/);
});
