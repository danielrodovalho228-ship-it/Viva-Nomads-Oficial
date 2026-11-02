/*
  Frente 1, rodada 4 — achado 126 (média-alta): a rotina do atendimento (a cada 15 min) conferia se já tinha avisado
  ("escalado_2h/6h" e "manutencao_atrasada") sem olhar o erro da leitura. Na falha, o aviso saía de novo a cada rodada
  (push e e-mail ao Daniel ou ao dono) e, no nível de 6 h, a prioridade do chamado subia outra vez. Agora a leitura
  que falha pula o chamado (a próxima rodada confere de novo).
  Roda: node --test src/lib/atendimento/achado126-cron.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../app/api/cron/atendimento/route.ts", import.meta.url), "utf8");

test("cron do atendimento: sem conferir o aviso anterior, não avisa de novo", () => {
  assert.equal(src.match(/if \(erroJa \|\| \(ja && ja\.length\)\) continue;/g)?.length, 2);
  assert.doesNotMatch(src, /if \(ja && ja\.length\) continue;/);
  const esc = src.indexOf('acao, detalhe: `${c.horas} h sem resposta humana`');
  assert.ok(src.indexOf("if (erroJa || (ja && ja.length)) continue;") < esc, "a guarda vem antes do aviso e da prioridade");
});
