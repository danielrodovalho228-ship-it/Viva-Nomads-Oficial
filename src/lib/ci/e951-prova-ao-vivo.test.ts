/*
  E951 — unitários da prova ao vivo: extração dos itens do título/corpo do PR, montagem do --grep, leitura das etiquetas,
  resultado por item e comentário. Roda: node --test src/lib/ci/e951-prova-ao-vivo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comentarioDoPr,
  etiquetasDoSpec,
  extrairItens,
  indiceDeEtiquetas,
  itensDaLista,
  montarGrep,
  resultadoPorItem,
  specsPorItem,
  testesDoRelatorio,
} from "./prova-ao-vivo.ts";

test("extração: E<n> do título e do corpo, sem repetição, em ordem numérica", () => {
  assert.deepEqual(extrairItens("Família 6: E936, E947 e E948", "Fecha o E948 (feriados).\nVer também E36 e E936."), ["E36", "E936", "E947", "E948"]);
  assert.deepEqual(extrairItens("E931: /buscar sem flutuante", null), ["E931"]);
  assert.deepEqual(extrairItens("Corrige busca", ""), []);
});

test("extração: não pega E colado em letra/dígito, hash, nem número no meio de palavra", () => {
  assert.deepEqual(extrairItens("PE948 SE12 commit 3fE948a", "AE1 E12a xE9"), []);
  assert.deepEqual(extrairItens("(E899)", "[E900] — E901."), ["E899", "E900", "E901"]);
  assert.deepEqual(extrairItens("e948 minúsculo não conta", ""), []);
});

test("lista do workflow_dispatch: vírgula, espaço e minúscula", () => {
  assert.deepEqual(itensDaLista("e899, E948  e936"), ["E899", "E936", "E948"]);
  assert.deepEqual(itensDaLista(""), []);
});

test("grep: exige @ao-vivo-seguro E a etiqueta de um dos itens; @E94 não pega @E948", () => {
  assert.equal(montarGrep([]), null);
  const re = new RegExp(montarGrep(["E948", "E936"])!);
  assert.ok(re.test("T1648 — prazo do documento @E948 @ao-vivo-seguro"));
  assert.ok(re.test("@ao-vivo-seguro @E936 E936 limpeza"));
  assert.ok(!re.test("T1648 — prazo do documento @E948"), "sem a etiqueta segura não roda");
  assert.ok(!re.test("@ao-vivo-seguro @E9480"), "@E948 não casa com @E9480");
  assert.ok(!re.test("@ao-vivo-seguro @E94"), "item fora da lista");
  assert.ok(!re.test("@E948 @ao-vivo-seguro-nao"), "etiqueta parecida não vale");
  const so94 = new RegExp(montarGrep(["E94"])!);
  assert.ok(!so94.test("@ao-vivo-seguro @E948"), "@E94 não pega @E948");
});

test("etiquetas: tag em lista, tag em string e as do título", () => {
  const fonte = `test.describe("T1 — busca @criticos", { tag: ["@E948", "@ao-vivo-seguro"] }, () => {\n test("abre", { tag: '@E36' }, async () => {});\n});`;
  assert.deepEqual(etiquetasDoSpec(fonte), ["@E36", "@E948", "@ao-vivo-seguro", "@criticos"]);
  assert.deepEqual(etiquetasDoSpec(`test("sem etiqueta", async () => {})`), []);
  const idx = indiceDeEtiquetas({ "a.spec.ts": fonte, "b.spec.ts": `test("x", async () => {})`, "c.spec.ts": `test.describe("y", { tag: ["@E948"] }, () => {})` });
  assert.deepEqual(Object.keys(idx).sort(), ["a.spec.ts", "c.spec.ts"]);
  assert.deepEqual(specsPorItem(["E948", "E1"], idx), { E948: ["a.spec.ts"], E1: [] }, "c tem @E948 mas não é segura: não conta");
});

test("resultado por item: passou, falhou e 'não há' (sem spec etiquetado, nada genérico roda)", () => {
  const relatorio = {
    suites: [
      {
        file: "a.spec.ts",
        specs: [
          { file: "a.spec.ts", tags: ["@E948", "@ao-vivo-seguro"], tests: [{ status: "expected", results: [{ status: "passed" }] }] },
          { file: "a.spec.ts", tags: ["@E936", "@ao-vivo-seguro"], tests: [{ status: "unexpected", results: [{ status: "failed" }] }] },
        ],
        suites: [{ specs: [{ file: "a.spec.ts", tags: ["E936", "ao-vivo-seguro"], tests: [{ status: "flaky", results: [{ status: "failed" }, { status: "passed" }] }] }] }],
      },
    ],
  };
  const testes = testesDoRelatorio(relatorio);
  assert.equal(testes.length, 3);
  assert.deepEqual(testes[2].etiquetas, ["@E936", "@ao-vivo-seguro"]);
  const r = resultadoPorItem(["E936", "E948", "E1"], testes, { E936: ["a.spec.ts"], E948: ["a.spec.ts"], E1: [] });
  assert.equal(r.E948.situacao, "passou");
  assert.equal(r.E936.situacao, "falhou", "falha e instável contam como falha");
  assert.deepEqual(r.E1, { situacao: "não há", specs: [], passou: 0, falhou: 0, pulou: 0 });
  const md = comentarioDoPr(r, { alvo: "https://vivanomads.com.br", sha: "abcdef1234567", runUrl: "https://x/run/1" });
  assert.match(md, /\| E948 \| passou \| `a\.spec\.ts` \| 1 \/ 0 \/ 0 \|/);
  assert.match(md, /\| E1 \| prova automática: não há \| — \| — \|/);
  assert.match(md, /Commit `abcdef123`/);
});
