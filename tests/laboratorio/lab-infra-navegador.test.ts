/*
  ORDEM-DUET-149, item 3 (proposta da Pista 3, aprovada em draft): quando a instalação de um navegador do Playwright falha
  numa fatia, os testes desse navegador NÃO viram falha nem regressão. Saem como "não iniciados por infraestrutura",
  num balde próprio do consolidar, cada um com a corrida, o job e o passo. Nada é apagado em silêncio.
  Caso real: corrida 44429658751, fatia 20. As 2 tentativas do WebKit esgotaram no apt, e os 10 testes do projeto
  webkit-iphone (t82, t151, t152) caíram com "browserType.launch: Executable doesn't exist" e foram contados como regressão.
  Roda: node --test tests/laboratorio/lab-infra-navegador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { separarFalhasDeInfra } from "../../scripts/lab/infra-navegador.mjs";
import { completude, textoCompletude } from "../../scripts/lab/conferir-completude.mjs";

const ERRO_LAUNCH = "browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/webkit-2311/pw_run.sh";
type T = { status: string; expectedStatus: string; projectName: string; results: { status: string; error?: { message: string } }[] };
const t = (projectName: string, status: string, results: { status: string; error?: { message: string } }[]): T => ({
  status, expectedStatus: "passed", projectName, results,
});
const rel = (specs: [string, T[]][], extra: Record<string, unknown> = {}) => ({
  suites: [{ title: "t82-login-celular.spec.ts", file: "t82-login-celular.spec.ts", specs: specs.map(([title, tests]) => ({ title, file: "t82-login-celular.spec.ts", tests })), suites: [] }],
  stats: { expected: 1, unexpected: 3, flaky: 0, skipped: 0 },
  ...extra,
});
const ORIGEM = { corrida: "44429658751", job: "laboratorio (fatia 20/25)", passo: "Instalar WebKit do Playwright (só 3 specs de celular usam)" };

test("separa só os testes do navegador que falhou e que caíram por falta do executável", () => {
  const r = rel([
    ["login certo", [t("webkit-iphone", "unexpected", [{ status: "failed", error: { message: ERRO_LAUNCH } }])]],
    ["senha errada", [t("webkit-iphone", "unexpected", [{ status: "failed", error: { message: ERRO_LAUNCH } }, { status: "failed", error: { message: ERRO_LAUNCH } }])]],
    ["falha de verdade no WebKit", [t("webkit-iphone", "unexpected", [{ status: "failed", error: { message: "expect(locator).toBeVisible() failed" } }])]],
    ["chromium que passou", [t("chromium", "expected", [{ status: "passed" }])]],
  ]);
  const s = separarFalhasDeInfra(r, { projeto: "webkit-iphone", ...ORIGEM });
  assert.deepEqual(s.afetados.map((a) => a.chave), [
    "webkit-iphone › t82-login-celular.spec.ts › login certo",
    "webkit-iphone › t82-login-celular.spec.ts › senha errada",
  ]);
  for (const a of s.afetados) assert.deepEqual({ corrida: a.corrida, job: a.job, passo: a.passo }, ORIGEM);
  // Saem da contagem de falhas: não rodaram (status skipped sem resultado), e a falha de verdade fica.
  assert.equal(s.resultado.stats.unexpected, 1);
  const testes = s.resultado.suites[0].specs.map((sp: { tests: T[] }) => sp.tests[0]);
  assert.deepEqual(testes.map((x: T) => [x.status, x.results.length]), [["skipped", 0], ["skipped", 0], ["unexpected", 1], ["expected", 1]]);
  assert.equal(s.restamFalhas, true);
});

test("sem nenhuma outra falha, a fatia deixa de estar vermelha só pelo navegador", () => {
  const r = rel([["login certo", [t("webkit-iphone", "unexpected", [{ status: "failed", error: { message: ERRO_LAUNCH } }])]]]);
  r.stats.unexpected = 1;
  const s = separarFalhasDeInfra(r, { projeto: "webkit-iphone", ...ORIGEM });
  assert.equal(s.resultado.stats.unexpected, 0);
  assert.equal(s.restamFalhas, false);
});

test("o consolidar põe os afetados num balde próprio: não contam como 'não executados' nem reprovam a completude", () => {
  const listagem = rel([["login certo", [t("webkit-iphone", "skipped", [])]], ["passa", [t("chromium", "skipped", [])]]]);
  const rodada = rel([["login certo", [t("webkit-iphone", "skipped", [])]], ["passa", [t("chromium", "expected", [{ status: "passed" }])]]]);
  const infra = [{ chave: "webkit-iphone › t82-login-celular.spec.ts › login certo", ...ORIGEM }];
  const c = completude(listagem, rodada, infra);
  assert.deepEqual(c.naoExecutados, []);
  assert.deepEqual(c.naoIniciadosPorInfra, infra);
  assert.equal(c.ok, true);
  const texto = textoCompletude(c);
  assert.match(texto, /não iniciados por infraestrutura 1/);
  assert.match(texto, /webkit-iphone › t82-login-celular\.spec\.ts › login certo — corrida 44429658751 · job laboratorio \(fatia 20\/25\) · passo Instalar WebKit do Playwright/);
});

test("um teste no balde da infra que afinal rodou não fica no balde (só o que não rodou)", () => {
  const listagem = rel([["login certo", [t("webkit-iphone", "skipped", [])]]]);
  const rodada = rel([["login certo", [t("webkit-iphone", "expected", [{ status: "passed" }])]]]);
  const c = completude(listagem, rodada, [{ chave: "webkit-iphone › t82-login-celular.spec.ts › login certo", ...ORIGEM }]);
  assert.deepEqual(c.naoIniciadosPorInfra, []);
  assert.equal(c.executados, 1);
});

test("sem balde de infra, a completude segue igual (compatível com a chamada antiga)", () => {
  const listagem = rel([["login certo", [t("webkit-iphone", "skipped", [])]]]);
  const c = completude(listagem, rel([]));
  assert.deepEqual(c.naoExecutados, ["webkit-iphone › t82-login-celular.spec.ts › login certo"]);
  assert.deepEqual(c.naoIniciadosPorInfra, []);
  assert.equal(c.ok, false);
});

const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
test("workflow: o passo do WebKit tem id, e o fim do passo da suíte separa os afetados quando ele falha", () => {
  const webkit = yml.slice(yml.indexOf("- name: Instalar WebKit do Playwright"), yml.indexOf("- name: Rodar a suíte E2E"));
  assert.match(webkit, /id: webkit/);
  const passo = yml.slice(yml.indexOf("- name: Rodar a suíte E2E"), yml.indexOf("- name: Guardar relatório"));
  assert.match(passo, /set \+e/);
  assert.match(passo, /WEBKIT_INSTALOU: \$\{\{ steps\.webkit\.outcome \}\}/);
  assert.match(passo, /if \[ "\$WEBKIT_INSTALOU" = failure \] && \[ "\$RC" -ne 0 \]; then/);
  assert.match(passo, /node scripts\/lab\/infra-navegador\.mjs/);
  assert.match(passo, /--projeto webkit-iphone --corrida "\$\{\{ github\.run_id \}\}"/);
  // A fatia só deixa de ser vermelha quando o que falhou foi SÓ o navegador que não instalou.
  assert.match(passo, /grep -q '\^restam_falhas=false\$' "\$GITHUB_OUTPUT" && RC=0/);
  assert.match(passo, /exit "\$RC"/);
});

test("workflow: o consolidar passa o balde da infra à completude", () => {
  const passo = yml.slice(yml.indexOf("- name: Conferir a completude"), yml.indexOf("- name: Baixar o resultado da quarentena"));
  assert.match(passo, /--infra fatias/);
});
