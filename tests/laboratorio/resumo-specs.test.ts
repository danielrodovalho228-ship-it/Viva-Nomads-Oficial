/*
  Modo --json do resumo do laboratório (vai para public.lab_execucoes).
  Roda: node --test tests/laboratorio/resumo-specs.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { coletar, resumoJson } from "../../scripts/lab/resumo-specs.mjs";

const t = (file: string, title: string, status: string, expectedStatus = "passed") => ({ title, tests: [{ status, expectedStatus }], file });
const dados = {
  suites: [
    { file: "t1-a.spec.ts", specs: [t("t1-a.spec.ts", "ok", "expected"), t("t1-a.spec.ts", "quebrou", "unexpected")] },
    { file: "t2-b.spec.ts", specs: [t("t2-b.spec.ts", "pulado", "skipped"), t("t2-b.spec.ts", "oscila", "flaky"), t("t2-b.spec.ts", "conhecida", "expected", "failed")] },
  ],
};

test("resumoJson: totais, por_spec e só os títulos dos que falharam", () => {
  const r = resumoJson(coletar(dados.suites));
  assert.deepEqual([r.passou, r.falhou, r.pulou, r.instavel], [1, 1, 1, 1]);
  assert.equal((r.por_spec as Record<string, { conhecida: number }>)["t2-b.spec.ts"].conhecida, 1);
  assert.deepEqual(r.falhas.map((f: { titulo: string }) => f.titulo), ["quebrou", "oscila"]);
});

test("resumoJson: sem testes (a suíte nem rodou) dá zeros, nunca erro", () => {
  const r = resumoJson([]);
  assert.deepEqual([r.passou, r.falhou, r.pulou, r.instavel, r.falhas.length], [0, 0, 0, 0, 0]);
});
