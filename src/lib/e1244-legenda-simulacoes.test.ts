/*
  E1244 (ORDEM-DUET 1233, texto do coordenador) — a legenda da fila segue o estado da opção "Incluir simulações".
    desligada: "Simulações ficam fora. Ligue 'Incluir simulações' para vê-las."
    ligada:    "Incluindo simulações, marcadas como 'Simulação'. Elas não entram nos números."
  A opção só vale na aba da fila (a aprovação nunca a leva): fora dela, a legenda é a de desligada.
  Roda: node --test src/lib/e1244-legenda-simulacoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mod = (await import("./atendimento-simulacoes.ts").catch(() => ({}))) as { legendaDaFila?: (ligada: boolean) => string };

test("1. os dois textos exactos do coordenador", () => {
  assert.equal(typeof mod.legendaDaFila, "function");
  assert.equal(mod.legendaDaFila!(false), "Simulações ficam fora. Ligue 'Incluir simulações' para vê-las.");
  assert.equal(mod.legendaDaFila!(true), "Incluindo simulações, marcadas como 'Simulação'. Elas não entram nos números.");
});

test("2. (ORDEM-DUET 1237) a legenda SÓ na aba da fila, pelo estado da opção; nas outras abas, nenhuma linha de legenda", () => {
  const tela = readFileSync(new URL("../app/(dashboard)/admin/atendimento/atendimento-client.tsx", import.meta.url), "utf8");
  assert.match(tela, /subtitle=\{aba === "fila" \? `Chamados por prioridade e prazo\. \$\{legendaDaFila\(!!filtros\.simulacoes\)\}` : "Chamados por prioridade e prazo\."\}/);
  assert.doesNotMatch(tela, /subtitle="Chamados por prioridade e prazo\. Simulações ficam fora\."/, "a legenda fixa sai");
});
