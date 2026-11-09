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
  assert.deepEqual(matriz, Array.from({ length: n }, (_, i) => i + 1));
  assert.match(yml, /name: laboratorio \(fatia \$\{\{ matrix\.fatia \}\}\/\d+\)/);
  assert.match(yml, /--esperadas \d+/);
  assert.equal(Number(/--esperadas (\d+)/.exec(yml)?.[1]), n, "o consolidar espera o mesmo número de fatias");
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

test("E775: a fila de merge roda o verify, o lab-critico e a suíte completa fatiada (check suite-completa)", () => {
  for (const f of ["ci.yml", "lab-critico.yml", "laboratorio.yml"]) {
    const gatilhos = readFileSync(`.github/workflows/${f}`, "utf8").split("\njobs:")[0].split("\npermissions:")[0];
    assert.match(gatilhos, /^\s+merge_group:/m, `${f} precisa do gatilho merge_group`);
  }
  assert.match(yml, /consolidar:\n\s+# Nome estável do check obrigatório da fila de merge \(E775\)[^\n]*\n\s+name: suite-completa/);
  assert.match(yml, /needs: laboratorio/);
  assert.equal(Number(/--shard=\$\{\{ matrix\.fatia \}\}\/(\d+)/.exec(yml)?.[1]), 16, "desenho aprovado: 16 fatias");
});

test("o resumo da suíte inteira vai ao banco por arquivo, nunca como argumento do psql (E2BIG, run 42536824482)", () => {
  const consolidar = yml.split("  consolidar:")[1];
  assert.doesNotMatch(consolidar, /-v resumo=/, "o resumo passa de 128 KB: não pode ir em argv");
  assert.doesNotMatch(consolidar, /-v categoria=/);
  assert.match(consolidar, /\\set resumo `cat "\$RESUMO_ARQ"`/);
  assert.match(consolidar, /:'resumo'::jsonb/);
});
