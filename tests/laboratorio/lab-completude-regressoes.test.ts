/*
  Frente 0 (correção consolidada de 11/11/2026): o laboratório agendado tem que ENXERGAR as regressões.
  1) Completude: todo teste listado por `playwright test --list` tem que ter rodado (ou estar pulado de propósito).
     Rodada que corta testes (teto global estourado, fatia perdida) fica vermelha.
  2) Detector: spec com algum registro verde em public.lab_execucoes e vermelho na rodada atual = regressão.
  Roda: node --test tests/laboratorio/lab-completude-regressoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { completude, testesDoRelatorio } from "../../scripts/lab/conferir-completude.mjs";
import { detectarRegressoes, textoRegressoes } from "../../scripts/lab/detectar-regressoes.mjs";
import { caminhosDoPrerender } from "../../scripts/lab/limpar-prerender.mjs";

type Teste = { status: string; expectedStatus: string; results: { status: string }[]; projectName?: string };
const tst = (status: string, expectedStatus: string, results: string[], projectName = "chromium"): Teste => ({
  status,
  expectedStatus,
  projectName,
  results: results.map((s) => ({ status: s })),
});
/** Relatório no formato do JSON do Playwright: um arquivo, um describe, specs com testes. */
const relatorio = (specs: [string, Teste[]][], arquivo = "t1-a.spec.ts") => ({
  suites: [
    {
      title: arquivo,
      file: arquivo,
      specs: [],
      suites: [{ title: "bloco", file: arquivo, specs: specs.map(([title, tests]) => ({ title, file: arquivo, tests })) }],
    },
  ],
});

// A listagem (`--list --reporter=json`) traz todos os testes com results: [].
const listagem = relatorio([
  ["passa", [tst("skipped", "passed", [])]],
  ["pulado de propósito", [tst("skipped", "skipped", [])]],
  ["cortado pelo teto", [tst("skipped", "passed", [])]],
  ["nunca começou", [tst("skipped", "passed", [])]],
  ["só no celular", [tst("skipped", "passed", [], "webkit-iphone")]],
]);

test("completude: executados igual a listados passa (pulo declarado conta como esperado)", () => {
  const rodada = relatorio([
    ["passa", [tst("expected", "passed", ["passed"])]],
    ["pulado de propósito", [tst("skipped", "skipped", ["skipped"])]],
    ["cortado pelo teto", [tst("unexpected", "passed", ["failed", "failed"])]],
    ["nunca começou", [tst("flaky", "passed", ["failed", "passed"])]],
    ["só no celular", [tst("expected", "passed", ["passed"], "webkit-iphone")]],
  ]);
  const c = completude(listagem, rodada);
  assert.equal(c.listados, 5);
  assert.equal(c.executados, 4);
  assert.equal(c.pulosDeclarados, 1);
  assert.deepEqual(c.naoExecutados, []);
  assert.equal(c.ok, true);
});

test("completude: executados menor que listados REPROVA (teto global, teste que nunca começou, fatia perdida)", () => {
  // O que a rodada de 11/11 fez: o teto global corta o teste no meio (skipped com resultado) e os seguintes nem começam
  // (skipped sem resultado). E a fatia do webkit não entregou o arquivo: o teste some do relatório.
  const rodada = relatorio([
    ["passa", [tst("expected", "passed", ["passed"])]],
    ["pulado de propósito", [tst("skipped", "skipped", ["skipped"])]],
    ["cortado pelo teto", [tst("skipped", "passed", ["skipped"])]],
    ["nunca começou", [tst("skipped", "passed", [])]],
  ]);
  const c = completude(listagem, rodada);
  assert.equal(c.listados, 5);
  assert.equal(c.executados, 1);
  assert.equal(c.pulosDeclarados, 1);
  assert.equal(c.ok, false);
  assert.deepEqual(c.naoExecutados, [
    "chromium › t1-a.spec.ts › bloco › cortado pelo teto",
    "chromium › t1-a.spec.ts › bloco › nunca começou",
    "webkit-iphone › t1-a.spec.ts › bloco › só no celular",
  ]);
});

test("completude: listagem vazia ou rodada sem nenhum arquivo nunca passa como completa", () => {
  assert.equal(completude({ suites: [] }, { suites: [] }).ok, false, "sem listagem não há como provar a completude");
  assert.equal(completude(listagem, { suites: [] }).ok, false);
  assert.equal(completude(listagem, { suites: [] }).naoExecutados.length, 5);
});

test("completude: a chave separa projeto, arquivo e describe (títulos iguais em lugares diferentes não se confundem)", () => {
  const a = testesDoRelatorio(relatorio([["mesmo título", [tst("expected", "passed", ["passed"])]]], "t1-a.spec.ts"));
  const b = testesDoRelatorio(relatorio([["mesmo título", [tst("expected", "passed", ["passed"])]]], "t2-b.spec.ts"));
  assert.notEqual(a[0].chave, b[0].chave);
  const c = completude(relatorio([["mesmo título", [tst("skipped", "passed", [])]]], "t2-b.spec.ts"), relatorio([["mesmo título", [tst("expected", "passed", ["passed"])]]], "t1-a.spec.ts"));
  assert.equal(c.ok, false, "o teste do t1 não cobre o do t2");
});

const historico = JSON.parse(readFileSync("tests/laboratorio/fixtures/regressoes/historico-verdes.json", "utf8"));
const atual = JSON.parse(readFileSync("tests/laboratorio/fixtures/regressoes/rodada-atual.json", "utf8"));

test("detector: verde→vermelho é detectado; vermelho→vermelho e verde→verde não são", () => {
  const r = detectarRegressoes(historico, atual.por_spec);
  assert.deepEqual(r, [{ spec: "t132-solicitar-reserva.spec.ts", ultimoVerde: "2026-10-23T09:12:00Z", falhou: 1 }]);
  const specs = r.map((x) => x.spec);
  assert.ok(!specs.includes("t999-sempre-vermelho.spec.ts"), "vermelho→vermelho (nunca verde) não é regressão");
  assert.ok(!specs.includes("t7-fluxo-publico.spec.ts"), "verde→verde não é regressão");
  assert.ok(!specs.includes("t85-conferencia-entrada-saida.spec.ts"), "instável que passou na 2ª tentativa não é vermelho");
});

test("detector: histórico vazio não inventa regressão; spec ausente da rodada não conta como vermelha", () => {
  assert.deepEqual(detectarRegressoes({}, atual.por_spec), []);
  assert.deepEqual(detectarRegressoes(historico, {}), []);
});

test("detector: o texto da rodada lista cada regressão com a data do último verde", () => {
  const txt = textoRegressoes(detectarRegressoes(historico, atual.por_spec));
  assert.match(txt, /1 spec voltou a falhar/);
  assert.match(txt, /\| t132-solicitar-reserva\.spec\.ts \| 2026-10-23 \| 1 \|/);
  assert.match(textoRegressoes([]), /Nenhuma regressão/);
});

test("limpar-prerender: apaga a saída de cada rota do prerender-manifest e o route-cache, nada mais", () => {
  const c = caminhosDoPrerender({ routes: { "/": {}, "/cidades/uberlandia": {}, "/sitemap.xml": {} } }, ".next");
  assert.ok(c.includes(".next/server/app/index.html"));
  assert.ok(c.includes(".next/server/app/index.segments"));
  assert.ok(c.includes(".next/server/app/cidades/uberlandia.rsc"));
  assert.ok(c.includes(".next/server/app/sitemap.xml.body"));
  assert.ok(c.includes(".next/server/route-cache"));
  assert.ok(c.every((p) => p.startsWith(".next/server/")), "só dentro de .next/server");
  assert.ok(!c.some((p) => /page\.js|\.nft\.json|manifest/.test(p)), "o código das páginas e os manifestos ficam");
  assert.deepEqual(caminhosDoPrerender({}, ".next"), [".next/server/route-cache"]);
});

const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
const [antesDoConsolidar, consolidar = ""] = yml.split("\n  consolidar:");

test("workflow: a suíte inteira não roda mais a cada push na main; roda no agendado e no disparo manual", () => {
  const gatilhos = yml.slice(yml.indexOf("\non:"), yml.indexOf("\npermissions:"));
  assert.match(gatilhos, /schedule:/);
  assert.match(gatilhos, /workflow_dispatch:/);
  assert.doesNotMatch(gatilhos, /^\s+push:/m);
  assert.doesNotMatch(gatilhos, /pull_request/);
});

test("workflow: o .next é construído UMA vez e reaproveitado pelas fatias", () => {
  const construir = antesDoConsolidar.slice(antesDoConsolidar.indexOf("\n  construir:"));
  const fatia = antesDoConsolidar.slice(antesDoConsolidar.indexOf("\n  laboratorio:"), antesDoConsolidar.indexOf("\n  construir:"));
  assert.ok(construir.length > 100 && fatia.length > 100, "os dois jobs existem");
  assert.match(construir, /run: npm run build/);
  assert.match(construir, /playwright test --list --reporter=json/, "a listagem que o consolidar compara sai do mesmo commit");
  assert.equal([...yml.matchAll(/run: npm run build/g)].length, 1, "um build só no workflow");
  assert.match(fatia, /needs: construir/);
  assert.doesNotMatch(fatia, /npm run build/);
  assert.match(fatia, /name: laboratorio-\$\{\{ github\.run_id \}\}-build/);
  // As páginas pré-renderizadas no build leram o banco do job de build: a fatia as apaga para o servidor gerar de novo
  // com o banco dela (provado em next 16: sem a saída do prerender e sem o route-cache, a página sai do banco da fatia).
  assert.match(fatia, /node scripts\/lab\/limpar-prerender\.mjs/);
  // As chaves NEXT_PUBLIC_ entram no bundle no build: a fatia confere que o Supabase dela tem a mesma chave anônima.
  assert.match(construir, /chave-anon\.sha256/);
  assert.match(fatia, /chave-anon\.sha256/);
});

test("workflow: o consolidar confere a completude e as regressões, grava os números e fica vermelho em qualquer um", () => {
  assert.match(consolidar, /node scripts\/lab\/conferir-completude\.mjs/);
  assert.match(consolidar, /node scripts\/lab\/detectar-regressoes\.mjs/);
  assert.match(consolidar, /id: completude/);
  assert.match(consolidar, /id: regressoes/);
  // O histórico sai do banco antes de gravar a rodada atual; pull_request não entra (código que não estava na main).
  assert.ok(consolidar.indexOf("detectar-regressoes") < consolidar.indexOf("insert into public.lab_execucoes"));
  assert.match(consolidar, /gatilho is distinct from 'pull_request'/);
  assert.match(consolidar, /listados, executados, nao_executados, regressoes/);
  const final = consolidar.slice(consolidar.lastIndexOf("- name: Marcar a execução como falha"));
  assert.match(final, /steps\.completude\.outcome == 'failure'/);
  assert.match(final, /steps\.regressoes\.outcome == 'failure'/);
  assert.match(final, /needs\.laboratorio\.result != 'success'/);
});

test("migração 0341: colunas da completude e das regressões em lab_execucoes, com aplicar idempotente e rollback", () => {
  const m = readFileSync("supabase/migrations/0341_lab_execucoes_completude_regressoes.sql", "utf8");
  for (const c of ["listados", "executados", "nao_executados", "regressoes"]) assert.match(m, new RegExp(`add column if not exists ${c} `));
  const a = readFileSync("supabase/producao/aplicar-0341.sql", "utf8");
  assert.match(a, /^begin;/m);
  assert.match(a, /^commit;/m);
  assert.match(a, /'0341_lab_execucoes_completude_regressoes'/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261111000341'\)/);
  const r = readFileSync("supabase/producao/rollback/0341_rollback.sql", "utf8");
  for (const c of ["listados", "executados", "nao_executados", "regressoes"]) assert.match(r, new RegExp(`drop column if exists ${c}`));
});
