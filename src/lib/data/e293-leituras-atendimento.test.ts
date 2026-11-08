/*
  Erros/estados vazios (rodada 7) — abrir chamado: falha de LEITURA ao conferir o contexto (pedido/contrato/anúncio) não pode
  descartá-lo em silêncio — no "não consegui entrar" isso deixava de abrir a ordem URGENTE de manutenção sem avisar.
  Roda: node --test src/lib/data/e293-leituras-atendimento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../../../src/lib/data/atendimento-actions.ts", import.meta.url), "utf8");
const i0 = s.indexOf("async function contextoValido(");
const corpo = s.slice(i0, s.indexOf("\n}\n", i0));

test("contextoValido distingue 'não é da pessoa' (false) de 'não deu para ler' (erro)", () => {
  assert.match(corpo, /Promise<boolean \| "erro">/);
  // Os 5 ramos (pedido, contrato, parceiro, perfil, anúncio) olham o erro de banco.
  assert.equal((corpo.match(/error: erro/g) ?? []).length, 5);
  assert.equal((corpo.match(/if \(erro\) return "erro";/g) ?? []).length, 5);
});

test("abrir chamado: contexto que não pôde ser lido devolve erro, em vez de seguir sem contexto", () => {
  assert.match(s, /const MSG_CONTEXTO_SEM_LEITURA = "[^"]+";/);
  assert.match(s, /const valido = await contextoValido\(admin, user\.id, input\.contextoTipo, input\.contextoId\);\s*\n\s*if \(valido === "erro"\) return \{ ok: false, error: MSG_CONTEXTO_SEM_LEITURA \};\s*\n\s*if \(valido\) \{/);
});
