/* E680 — a lista de estadias de uma conta NUNCA mostra estadia de outra, nem por uma renderização.
   Roda: node --test src/lib/sessao/e680-lista-da-conta.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { soDaConta } from "./lista-da-conta.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("só ficam os itens da conta que está logada no navegador", () => {
  const itens = [{ id: "a", paraUsuario: "lucas" }, { id: "b", paraUsuario: "paulo" }];
  assert.deepEqual(soDaConta(itens, "lucas").map((i) => i.id), ["a"]);
  assert.deepEqual(soDaConta(itens, "paulo").map((i) => i.id), ["b"]);
  assert.deepEqual(soDaConta(itens, "outra"), []);
});

test("antes de o navegador saber quem é (sem usuário), vale a lista que o servidor montou para a sessão do pedido", () => {
  const itens = [{ id: "a", paraUsuario: "lucas" }];
  assert.deepEqual(soDaConta(itens, null), itens);
  assert.deepEqual(soDaConta(itens, undefined), itens);
});

test("item sem dono declarado nunca passa quando o navegador sabe quem é", () => {
  assert.deepEqual(soDaConta([{ id: "x" } as { id: string; paraUsuario?: string }], "lucas"), []);
});

test("a home leva o dono da lista em cada estadia e o cartão filtra pela conta do navegador", () => {
  const est = ler("src/lib/data/estadia.ts");
  assert.match(est, /paraUsuario: string;/);
  assert.match(est, /paraUsuario: user\.id/);
  const tela = ler("src/app/(dashboard)/dashboard/visao-geral-client.tsx");
  assert.match(tela, /soDaConta\(doServidor, /);
});

test("Minhas estadias leva o dono da lista e filtra pela conta do navegador", () => {
  const acao = ler("src/lib/data/contratos-actions.ts");
  assert.match(acao, /paraUsuario: user\.id/);
  const cli = ler("src/app/(dashboard)/dashboard/locacoes/locacoes-client.tsx");
  assert.match(cli, /soDaConta\(real, /);
});
