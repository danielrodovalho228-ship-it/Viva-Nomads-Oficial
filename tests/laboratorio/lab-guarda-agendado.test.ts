/*
  Peça 25 / ORDEM-DUET-207 — guarda contra a corrida agendada DUPLICADA. O agendador do GitHub atrasa 7–10 h todos os
  crons do repositório (diagnóstico da peça 25: a `17 7` de 19/11 nasceu às 16:34:59Z, 44567713288, e sobrepôs-se à manual
  44559787258 no mesmo commit). Enquanto o disparo manual é o procedimento (ORDEM-189), a agendada atrasada que chega
  depois de uma corrida recente da main termina VERDE logo no início, com a nota "coberta pela corrida N", sem fatias e sem
  gravar no banco. Manual (workflow_dispatch) e push nunca são barrados.
  Roda: node --test tests/laboratorio/lab-guarda-agendado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decidirGuarda, JANELA_HORAS } from "../../scripts/lab/guarda-duplicado.mjs";

const wf = readFileSync(new URL("../../.github/workflows/laboratorio.yml", import.meta.url), "utf8");
const agora = new Date("2026-11-19T16:35:30Z");
const corrida = (id: number, criada: string, status = "completed", conclusao: string | null = "failure") => ({ id, created_at: criada, status, conclusion: conclusao });

test("agendada com uma corrida da main nas últimas 6 h: coberta, e diz por qual", () => {
  const r = decidirGuarda({ evento: "schedule", estaCorrida: 44567713288, corridas: [corrida(44567713288, "2026-11-19T16:34:59Z", "in_progress", null), corrida(44559787258, "2026-11-19T15:52:56Z", "in_progress", null)], agora });
  assert.deepEqual(r, { coberta: true, por: 44559787258 });
});

test("agendada sem corrida recente (a última passou das 6 h): corre", () => {
  const r = decidirGuarda({ evento: "schedule", estaCorrida: 9, corridas: [corrida(9, "2026-11-19T16:34:59Z", "in_progress", null), corrida(8, "2026-11-19T09:23:20Z")], agora });
  assert.deepEqual(r, { coberta: false, por: null });
});

test("corrida cancelada não cobre (não rodou a suíte)", () => {
  const r = decidirGuarda({ evento: "schedule", estaCorrida: 9, corridas: [corrida(8, "2026-11-19T15:00:00Z", "completed", "cancelled")], agora });
  assert.deepEqual(r, { coberta: false, por: null });
});

test("disparo manual e push nunca são barrados", () => {
  for (const evento of ["workflow_dispatch", "push"]) {
    const r = decidirGuarda({ evento, estaCorrida: 9, corridas: [corrida(8, "2026-11-19T16:00:00Z", "in_progress", null)], agora });
    assert.deepEqual(r, { coberta: false, por: null }, evento);
  }
});

test("a janela é de 6 h", () => {
  assert.equal(JANELA_HORAS, 6);
});

test("workflow: o job guarda corre primeiro, só lê as Actions, e o construir e o consolidar respeitam a guarda", () => {
  const jobGuarda = wf.split("\n  guarda:\n")[1]?.split(/\n  [a-z]+:\n/)[0] ?? "";
  assert.ok(jobGuarda, "existe o job `guarda`");
  assert.match(jobGuarda, /permissions:\s*\n\s*actions: read/);
  assert.match(jobGuarda, /node scripts\/lab\/guarda-duplicado\.mjs/);
  assert.match(jobGuarda, /coberta: \$\{\{ steps\.guarda\.outputs\.coberta \}\}/);
  const construir = wf.split("\n  construir:\n")[1].split(/\n  [a-z]+:\n/)[0];
  assert.match(construir, /needs: guarda/);
  assert.match(construir, /if: \$\{\{ needs\.guarda\.outputs\.coberta != 'true' \}\}/);
  const consolidar = wf.split("\n  consolidar:\n")[1].split(/\n  [a-z]+:\n/)[0];
  assert.match(consolidar, /needs: \[guarda, laboratorio\]/);
  assert.match(consolidar, /if: \$\{\{ !cancelled\(\) && needs\.guarda\.outputs\.coberta != 'true' \}\}/);
});

test("os três crons ficam (rede de segurança), sem mudança", () => {
  const crons = [...wf.split("\npermissions:")[0].matchAll(/cron: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(crons, ["17 7 * * *", "17 15 * * *", "17 23 * * *"]);
});
