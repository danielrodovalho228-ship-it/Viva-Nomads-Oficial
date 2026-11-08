/*
  Erros/estados vazios (rodada 8) — ordens de manutenção: falha de LEITURA da ordem não vira "Solicitação não encontrada" nem
  "Só o proprietário…" para quem é mesmo o proprietário. Roda: node --test src/lib/data/e293-leituras-manutencao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../../../src/lib/data/manutencao-actions.ts", import.meta.url), "utf8");

test("ordemDaParte separa falha de leitura de 'ordem que não é sua' (null)", () => {
  assert.match(s, /const MSG_ORDEM_SEM_LEITURA = "[^"]+";/);
  assert.match(s, /Promise<\{ ordem: OrdemDaParte; papel: PapelOrdem \} \| null \| "erro">/);
  // Só é "erro" quando as DUAS leituras (colunas novas e antigas) falham; a antiga serve de reserva para a coluna ausente.
  assert.match(s, /if \(nova\.error && antiga\?\.error\) return "erro";/);
});

test("as 6 ações que leem a ordem devolvem a mensagem de leitura, antes de qualquer mensagem de papel", () => {
  const usos = s.match(/const alvo = await ordemDaParte\(s, id\);\s*\n\s*if \(alvo === "erro"\) return \{ ok: false, error: MSG_ORDEM_SEM_LEITURA \};/g) ?? [];
  assert.equal(usos.length, 6);
  assert.equal((s.match(/await ordemDaParte\(/g) ?? []).length, 6);
});
