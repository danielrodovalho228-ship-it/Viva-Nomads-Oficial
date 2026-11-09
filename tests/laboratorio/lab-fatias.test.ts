import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acharResultados, juntar } from "../../scripts/lab/juntar-resultados.mjs";

/**
 * E744 — a suíte noturna é fatiada em jobs paralelos (--shard) e depois consolidada: nenhuma fatia pode ficar de fora
 * (a matriz cobre 1..N e o --shard usa o mesmo N), cada fatia entrega o resultado, e um consolidar grava UMA linha.
 */
const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");

test("a matriz cobre as fatias 1..N e o --shard usa o mesmo N", () => {
  const matriz = /fatia:\s*\[([^\]]+)\]/.exec(yml)?.[1]?.split(",").map((x) => Number(x.trim())) ?? [];
  const n = Number(/--shard=\$\{\{ matrix\.fatia \}\}\/(\d+)/.exec(yml)?.[1]);
  assert.ok(n >= 8, `fatias = ${n}`);
  // 16 gerais + 4 da varredura t48 (E744): a matriz tem n + PESADAS fatias (os casos 17..20 do case do workflow).
  const pesadas = ["17", "18", "19", "20"].filter((k) => new RegExp(`\\n\\s+${k}\\) GREP=`).test(yml)).length;
  assert.equal(pesadas, 4);
  assert.deepEqual(matriz, Array.from({ length: n + pesadas }, (_, i) => i + 1));
  assert.match(yml, /name: laboratorio \(fatia \$\{\{ matrix\.fatia \}\}\/\d+\)/);
  assert.match(yml, /--esperadas \d+/);
  assert.equal(Number(/--esperadas (\d+)/.exec(yml)?.[1]), n + pesadas, "o consolidar espera o mesmo número de fatias");
  assert.match(yml, /fail-fast: false/, "uma fatia vermelha não cancela as outras");
});

test("cada fatia guarda o próprio artifact e o consolidar grava uma linha só", () => {
  assert.match(yml, /name: laboratorio-\$\{\{ github\.run_id \}\}-fatia-\$\{\{ matrix\.fatia \}\}/);
  assert.match(yml, /pattern: laboratorio-\$\{\{ github\.run_id \}\}-fatia-\*/);
  assert.equal([...yml.matchAll(/- name: Registrar no banco/g)].length, 1);
  const [fatia, consolidar] = yml.split("  consolidar:");
  assert.ok(consolidar, "job consolidar existe");
  assert.doesNotMatch(fatia, /Registrar no banco/, "a fatia não grava no banco");
  assert.match(consolidar, /needs: laboratorio/);
  assert.match(consolidar, /if: \$\{\{ !cancelled\(\) \}\}/);
  assert.match(consolidar, /needs\.laboratorio\.result != 'success'/, "vermelho se alguma fatia falhou");
});

test("juntar: concatena as suites e soma os stats; fatia sem arquivo não derruba", () => {
  const j = juntar([
    { stats: { expected: 3, unexpected: 1, skipped: 0 }, suites: [{ file: "t1.spec.ts" }] },
    { stats: { expected: 5, unexpected: 0, skipped: 2 }, suites: [{ file: "t2.spec.ts" }, { file: "t3.spec.ts" }] },
  ]);
  assert.equal(j.suites.length, 3);
  assert.deepEqual([j.stats.expected, j.stats.unexpected, j.stats.skipped], [8, 1, 2]);
  assert.equal(juntar([]).suites.length, 0);
  const raiz = mkdtempSync(join(tmpdir(), "fatias-"));
  for (const n of ["a", "b"]) {
    mkdirSync(join(raiz, n, "tests", "laboratorio", "saida"), { recursive: true });
    writeFileSync(join(raiz, n, "tests", "laboratorio", "saida", "resultado.json"), "{}");
  }
  assert.equal(acharResultados(raiz).length, 2);
  assert.deepEqual(acharResultados(join(raiz, "nao-existe")), []);
});

test("o resumo da suíte inteira vai ao banco por arquivo, nunca como argumento do psql (E2BIG, run 42536824482)", () => {
  const consolidar = yml.split("  consolidar:")[1];
  assert.doesNotMatch(consolidar, /-v resumo=/, "o resumo passa de 128 KB: não pode ir em argv");
  assert.doesNotMatch(consolidar, /-v categoria=/);
  assert.match(consolidar, /\\set resumo `cat "\$RESUMO_ARQ"`/);
  assert.match(consolidar, /:'resumo'::jsonb/);
});

test("o supabase start da fatia tenta 5 vezes e reinicia o Docker da 2ª em diante (porta 54322 presa, fatias 11 e 4)", () => {
  const fatia = yml.split("  consolidar:")[0];
  assert.match(fatia, /for tentativa in 1 2 3 4 5; do/);
  assert.match(fatia, /sudo systemctl restart docker/);
  assert.match(fatia, /supabase start falhou 5 vezes/);
});

test("a varredura t48 (cadeia serial de ~100 min) sai das fatias gerais e roda em 4 fatias próprias, uma por grupo de testes", () => {
  const cfg = readFileSync("playwright.config.ts", "utf8");
  assert.match(cfg, /export const SPECS_PESADOS = \/t48-varredura\\\.spec\\\.ts\//);
  assert.match(cfg, /testIgnore: process\.env\.LAB_PESADOS === "fora" \? SPECS_PESADOS : undefined/);
  assert.match(yml, /LAB_PESADOS=fora npx playwright test --shard=\$\{\{ matrix\.fatia \}\}\/16/);
  assert.match(yml, /npx playwright test t48-varredura --grep "\$GREP"/);
  assert.match(yml, /if \[ "\$F" -le 16 \]/);
  // Os 4 grupos cobrem os 6 testes do t48 sem sobrepor: visitante (3) + uma fatia por persona logada (3).
  const spec = readFileSync("tests/e2e/specs/t48-varredura.spec.ts", "utf8");
  assert.match(spec, /mode: "serial"/, "a razão da separação: a cadeia é serial");
  for (const g of ["inquilino: todas as telas logadas", "proprietário: todas as telas logadas", "admin: todas as telas logadas"]) assert.ok(yml.includes(g), g);
  for (const t of ["visitante: todas as rotas do sitemap", "visitante a 1280 px", "endereços inexistentes", "sitemap limpo"]) assert.ok(spec.includes(t), t);
});

test("as fatias da varredura t48 têm teto maior que as gerais (a do admin levou 56 min) e cabem no timeout do job", () => {
  const job = Number(/timeout-minutes:\s*(\d+)/.exec(yml)?.[1]);
  const geral = Number(/LAB_PESADOS=fora[^\n]*--global-timeout=(\d+)/.exec(yml)?.[1]);
  const varredura = Number(/t48-varredura[^\n]*--global-timeout=(\d+)/.exec(yml)?.[1]);
  assert.ok(varredura > geral, `varredura ${varredura} > geral ${geral}`);
  assert.ok(varredura >= 90 * 60_000, "folga sobre os 56 min medidos");
  assert.ok(varredura < job * 60_000 - 10 * 60_000, "sobra tempo do job para preparo e para guardar o resultado");
});

test("a rotina de linhas de base visuais (E744) só gera artefato: não comita, não faz push, cobre os 3 specs de captura", () => {
  const w = readFileSync(".github/workflows/linhas-de-base.yml", "utf8");
  assert.match(w, /npx playwright test t245-visual-regressao t263-visual-41 t271-admin-visual --update-snapshots/);
  assert.match(w, /actions\/upload-artifact@v4/);
  assert.match(w, /node-version: "24\.22\.1"/);
  assert.match(w, /permissions:\s*\n\s*contents: read/, "somente leitura: aprovar imagem é decisão humana, via PR");
  assert.doesNotMatch(w, /git (commit|push)|contents: write/);
  // mesmo ambiente do laboratório: mesmas etapas de banco, seed, build e site
  for (const passo of ["supabase start", "seed-lab.mjs", "npm run build", "next start -p 3123", "playwright install"]) assert.ok(w.includes(passo), passo);
  // os 3 specs existem com esse nome
  for (const f of ["t245-visual-regressao", "t263-visual-41", "t271-admin-visual"]) assert.ok(readFileSync(`tests/e2e/specs/${f}.spec.ts`, "utf8").length > 0, f);
});
