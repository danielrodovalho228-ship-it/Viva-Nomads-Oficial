/*
  E1204 (ORDEM-DUET-972/973) — o período das linhas de "Seus fechamentos" segue a regra do E1089.
  Antes: a lista escrevia "X a Y" com o fim INCLUSIVO (a última noite) como segundo termo, contra o E1089. A linha C
  (candidatura por fechar) ainda punha a SAÍDA (`leads.fim_desejado`) no lugar do fim inclusivo: as três linhas
  tinham contas diferentes para a mesma estadia.
  Depois: no servidor, a linha C guarda o fim inclusivo (saída − 1), como as linhas A (proposta) e B (contrato); na
  tela, o período sai de `periodoPeloFim` — "Entrada DD/MM/AAAA · Saída DD/MM/AAAA · N diárias".
  Roda: node --test src/lib/fechamento/e1204-periodo-dos-fechos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { periodoDaCandidatura, textoDoPeriodoDoFecho } from "./fechos-do-dono.ts";
import { periodoEmDias } from "../contrato-periodo.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

test("linha C: a janela da candidatura (entrada, SAÍDA) vira o período de fim inclusivo (saída − 1)", () => {
  assert.deepEqual(periodoDaCandidatura("2026-12-01", "2027-01-01"), { inicio: "2026-12-01", fim: "2026-12-31" });
  assert.deepEqual(periodoDaCandidatura("2026-12-01T00:00:00Z", "2026-12-02T00:00:00Z"), { inicio: "2026-12-01", fim: "2026-12-01" });
  assert.equal(periodoDaCandidatura("2026-12-01", "2026-12-01"), null, "saída no dia da entrada: nenhum período");
  assert.equal(periodoDaCandidatura(null, "2027-01-01"), null);
  assert.equal(periodoDaCandidatura("2026-12-01", null), null);
});

test("o texto do período: Entrada · Saída · diárias, nunca a última noite como segundo termo de 'X a Y'", () => {
  const p = periodoEmDias("2026-12-01", 31); // o mesmo período das linhas A e B: fim inclusivo 31/12
  assert.equal(textoDoPeriodoDoFecho(p), "Entrada 01/12/2026 · Saída 01/01/2027 · 31 diárias");
  assert.equal(textoDoPeriodoDoFecho(null), null);
});

test("a mesma estadia dá o mesmo texto nas três linhas (A, B e C)", () => {
  const daProposta = periodoEmDias("2026-12-01", 31);
  const daCandidatura = periodoDaCandidatura("2026-12-01", "2027-01-01");
  assert.equal(textoDoPeriodoDoFecho(daCandidatura), textoDoPeriodoDoFecho(daProposta));
});

test("a fiação: o servidor usa periodoDaCandidatura na linha C e a tela usa textoDoPeriodoDoFecho", () => {
  const servidor = fonteSemComentarios(readFileSync("src/lib/data/fechos-do-dono-servidor.ts", "utf8"));
  assert.match(servidor, /periodo: periodoDaCandidatura\(j\?\.inicio_desejado \?\? null, j\?\.fim_desejado \?\? null\)/);
  assert.doesNotMatch(servidor, /fim: j\.fim_desejado/, "a saída nunca entra como fim inclusivo");
  const tela = fonteSemComentarios(readFileSync("src/app/(dashboard)/dashboard/fechamento/seus-fechamentos.tsx", "utf8"));
  assert.match(tela, /textoDoPeriodoDoFecho\(l\.periodo\)/);
  assert.doesNotMatch(tela, /\} a \$\{/, "nunca 'X a Y'");
});
