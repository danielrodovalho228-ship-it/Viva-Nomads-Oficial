/* E680 — a lista de estadias de uma conta NUNCA mostra estadia de outra, nem por uma renderização.
   Roda: node --test src/lib/sessao/e680-lista-da-conta.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { contaConfirmada, soDaConta } from "./lista-da-conta.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("só ficam os itens da conta que está logada no navegador", () => {
  const itens = [{ id: "a", paraUsuario: "lucas" }, { id: "b", paraUsuario: "paulo" }];
  assert.deepEqual(soDaConta(itens, "lucas").map((i) => i.id), ["a"]);
  assert.deepEqual(soDaConta(itens, "paulo").map((i) => i.id), ["b"]);
  assert.deepEqual(soDaConta(itens, "outra"), []);
});

test("RESÍDUO E680: sem identidade CONFIRMADA no navegador a lista populada não aparece (a identidade persistida pode ser da conta anterior)", () => {
  const itens = [{ id: "a", paraUsuario: "lucas" }];
  assert.deepEqual(soDaConta(itens, null), []);
  assert.deepEqual(soDaConta(itens, undefined), []);
  assert.deepEqual(soDaConta(itens, ""), []);
});

test("RESÍDUO E680: só vale a identidade do store depois do authChecked (que NÃO é persistido e recomeça false a cada carga)", () => {
  assert.equal(contaConfirmada({ user: { id: "lucas" }, authChecked: false }), null, "persistida e ainda não conferida: pode ser a conta anterior");
  assert.equal(contaConfirmada({ user: { id: "lucas" }, authChecked: true }), "lucas");
  assert.equal(contaConfirmada({ user: null, authChecked: true }), null);
  assert.equal(contaConfirmada({ user: { id: "lucas" }, authChecked: undefined as unknown as boolean }), null);
  const store = ler("src/lib/store.ts");
  assert.match(store, /partialize: \(s\) => \(\{[\s\S]*?\}\)/);
  assert.doesNotMatch(store.slice(store.indexOf("partialize")), /^[^}]*authChecked:/, "authChecked não entra no que é persistido");
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
  assert.match(tela, /useAuthStore\(\(s\) => contaConfirmada\(s\)\)/);
});

test("Minhas estadias leva o dono da lista e filtra pela conta do navegador", () => {
  const acao = ler("src/lib/data/contratos-actions.ts");
  assert.match(acao, /paraUsuario: user\.id/);
  const cli = ler("src/app/(dashboard)/dashboard/locacoes/locacoes-client.tsx");
  assert.match(cli, /soDaConta\(real, /);
  assert.match(cli, /useAuthStore\(\(s\) => contaConfirmada\(s\)\)/);
});
