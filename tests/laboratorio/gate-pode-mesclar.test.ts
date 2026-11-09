/* Roda: node --test tests/laboratorio/gate-pode-mesclar.test.ts
  E775: o gate de merge próprio (a fila nativa não existe em repositório de conta pessoal). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error módulo .mjs sem tipos
import { avaliar, exigidosDe } from "../../scripts/gate/pode-mesclar.mjs";

const ok = (name: string, started_at = "2026-11-09T01:00:00Z") => ({ name, status: "completed", conclusion: "success", started_at });
const pr = { state: "open", draft: false, base: "main" };
const exigidos = ["verify", "lab-critico"];

test("pode: aberto, fora do rascunho, em dia com a main e com os checks exigidos verdes", () => {
  assert.deepEqual(avaliar({ pr, behindBy: 0, checks: [ok("verify"), ok("lab-critico"), ok("e2e")], exigidos }), { pode: true, motivos: [] });
});

test("não pode: rascunho, base errada, atrás da main (o CI não testou a combinação)", () => {
  const r = avaliar({ pr: { state: "open", draft: true, base: "claude-b/x" }, behindBy: 3, checks: [ok("verify"), ok("lab-critico")], exigidos });
  assert.equal(r.pode, false);
  assert.ok(r.motivos.some((m: string) => /rascunho/.test(m)));
  assert.ok(r.motivos.some((m: string) => /base é claude-b\/x/.test(m)));
  assert.ok(r.motivos.some((m: string) => /3 commit\(s\) atrás da main/.test(m)));
});

test("não pode: check ausente, em andamento ou vermelho; vale o mais recente com o mesmo nome", () => {
  const r = avaliar({
    pr, behindBy: 0, exigidos: ["verify", "lab-critico", "suite-completa"],
    checks: [ok("verify", "2026-11-09T01:00:00Z"), { name: "lab-critico", status: "in_progress", started_at: "2026-11-09T01:00:00Z" }],
  });
  assert.deepEqual(r.motivos, ["o check lab-critico ainda não terminou", "falta o check suite-completa no head"]);
  const reexec = avaliar({ pr, behindBy: 0, exigidos: ["verify"], checks: [{ name: "verify", status: "completed", conclusion: "failure", started_at: "2026-11-09T01:00:00Z" }, ok("verify", "2026-11-09T02:00:00Z")] });
  assert.equal(reexec.pode, true, "a reexecução verde mais nova vale");
  const vermelho = avaliar({ pr, behindBy: 0, exigidos: ["verify"], checks: [{ name: "verify", status: "completed", conclusion: "failure", started_at: "2026-11-09T01:00:00Z" }] });
  assert.deepEqual(vermelho.motivos, ["o check verify terminou em failure"]);
});

test("a lista de exigidos vem do JSON: sem a suíte enquanto ela não está verde; com ela depois", () => {
  const cfg = JSON.parse(readFileSync("scripts/gate/exigidos.json", "utf8"));
  assert.deepEqual(exigidosDe(cfg, false), ["verify", "lab-critico"]);
  assert.deepEqual(exigidosDe(cfg, true), ["verify", "lab-critico", "suite-completa"]);
});
