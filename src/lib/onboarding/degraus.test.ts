/* Roda: node --test src/lib/onboarding/degraus.test.ts — Prompt 43: perfil progressivo em 4 degraus. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { degrausPerfil } from "./degraus.ts";

const nada = { emailConfirmado: false, temNome: false, temFoto: false, temTelefone: false, identidadeConfirmada: false };

test("4 degraus na ordem, cada um com o 'para que serve'", () => {
  const d = degrausPerfil(nada);
  assert.deepEqual(d.map((x) => x.id), ["email", "basico", "telefone", "identidade"]);
  for (const x of d) assert.ok(x.paraQue.length > 10 && x.paraQue.length <= 80, x.id);
});

test("identidade é pedida só na transação; telefone não trava; feito mostra 'Feito' e não tem ação", () => {
  const d = degrausPerfil(nada);
  assert.equal(d[3].estado, "Pedido quando você fechar um contrato");
  assert.equal(d[3].acao, null);
  assert.match(d[2].paraQue, /Não trava nada/);
  const tudo = degrausPerfil({ emailConfirmado: true, temNome: true, temFoto: true, temTelefone: true, identidadeConfirmada: true });
  assert.ok(tudo.every((x) => x.feito && x.estado === "Feito" && x.acao === null));
});

test("nome sem foto ainda não conta como básico", () => {
  assert.equal(degrausPerfil({ ...nada, temNome: true }).find((x) => x.id === "basico")!.feito, false);
});
