/* Roda: node --test src/lib/painel/com-limite.test.ts — E503 (reprova da rodada 8): leitura do painel com tempo limite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comLimite, LIMITE_LEITURA_INICIO_MS, LIMITE_CASCA_MS } from "./com-limite.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E503: leitura que responde a tempo devolve o valor", async () => {
  assert.equal(await comLimite(Promise.resolve(7), 50), 7);
});

test("E503: leitura que não responde rejeita no prazo (a tela não fica presa no esqueleto)", async () => {
  const t0 = Date.now();
  await assert.rejects(comLimite(new Promise<number>(() => {}), 30), /tempo esgotado/);
  assert.ok(Date.now() - t0 < 500);
});

test("E503: erro da leitura segue como erro", async () => {
  await assert.rejects(comLimite(Promise.reject(new Error("falhou")), 50), /falhou/);
});

test("E503: a casca espera menos que a página (o menu pinta pela rota se a contagem atrasar)", () => {
  assert.ok(LIMITE_CASCA_MS < LIMITE_LEITURA_INICIO_MS);
  assert.ok(LIMITE_LEITURA_INICIO_MS <= 10_000);
});

test("E503: layout e Início não esperam leitura sem limite", () => {
  const layout = ler("app/(dashboard)/layout.tsx");
  assert.match(layout, /comLimite\(resolveInitialMode\(\)/);
  assert.match(layout, /comLimite\(contadoresIniciaisDoPainel\(\)/);
  const pagina = ler("app/(dashboard)/dashboard/inicio-dados.tsx");
  assert.match(pagina, /comLimite\(p, LIMITE_LEITURA_INICIO_MS\)/);
  // as leituras fora do `ou` também passam pelo limite
  for (const leitura of ["cidadeDoPerfil()", "getLatestDraft()", "visualizacoesDoDono(agora)", "minhaParceria()", "fatosDaConta(draft)", "carregarAgendaDoDono()"]) {
    assert.match(pagina, new RegExp(`comLimite\\(${leitura.replace(/[()]/g, "\\$&")}`), leitura);
  }
});
