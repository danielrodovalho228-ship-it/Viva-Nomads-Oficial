/*
  E1132 (ORDEM-DUET-575 registo; ORDEM-DUET-588/590 vez): a terceira `hojeBRT` privada — a de `src/lib/contrato-estado.ts`,
  que decide quando o contrato passa a "Encerrado em …" (E543) — dobra-se na fonte única do "hoje em Brasília",
  `hojeEmBrasilia` (`src/lib/datas-brasilia.ts`, E1115). Nenhum valor muda: o mesmo dia de Brasília, agora de um lugar só.
  Roda: node --test src/lib/e1132-hoje-do-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoDoContratoUnico } from "./contrato-estado.ts";
import { fonteSemComentarios as semComentarios } from "./fonte-sem-comentarios.ts";


test("E1132: contrato-estado.ts não tem um 'hoje' próprio — lê a fonte única hojeEmBrasilia", () => {
  const s = semComentarios(readFileSync("src/lib/contrato-estado.ts", "utf8"));
  assert.doesNotMatch(s, /function hojeBRT/, "sem hojeBRT privada");
  assert.doesNotMatch(s, /Intl\.DateTimeFormat\(/, "sem segunda conta do fuso");
  assert.doesNotMatch(s, /toISOString\(\)\.slice\(0, ?10\)/, "sem hoje em UTC");
  assert.match(s, /import \{ hojeEmBrasilia \} from "\.\/datas-brasilia\.ts";/);
  assert.match(s, /if \(p && p\.fim < hojeEmBrasilia\(agora\)\) \{/);
});

test("E1132: o encerramento pelo período vira no dia de Brasília — também entre as 21:00 e as 24:00", () => {
  const t = "2026-10-01T12:00:00Z";
  // Última noite 22/11/2026; a saída (e o encerramento) é 23/11/2026.
  const c = { status: "ativo", assinado_proprietario_em: t, assinado_inquilino_em: t, pagamentos_bloco: [], periodo: "[2026-10-01,2026-11-23)" };
  // 22/11 às 23:30 em Brasília (já 23/11 em UTC): ainda é a última noite — não encerra.
  assert.notEqual(estadoDoContratoUnico(c, "inquilino", new Date("2026-11-23T02:30:00Z")).chave, "encerrado_periodo");
  // 23/11 às 23:59:59 em Brasília (já 24/11 em UTC) e 23/11 às 00:00: encerrado no dia da saída.
  for (const agora of ["2026-11-23T03:00:00Z", "2026-11-24T02:59:59Z"]) {
    const e = estadoDoContratoUnico(c, "inquilino", new Date(agora));
    assert.equal(e.chave, "encerrado_periodo", agora);
    assert.equal(e.selo, "Encerrado em 23/11/2026", agora);
  }
});
