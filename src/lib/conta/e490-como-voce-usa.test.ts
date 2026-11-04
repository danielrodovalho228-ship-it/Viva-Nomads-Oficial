/*
  E490 — nome ≠ destino: o menu da Conta dizia "Como você usa a Viva" e a página aberta se chamava "Papéis e intenção".
  Correção: um nome só — "Como você usa a Viva" — no menu, no título da página e no título do bloco; o endereço
  (/dashboard/conta/papeis) continua o mesmo para não quebrar links e e-mails já enviados.
  Roda: node --test src/lib/conta/e490-como-voce-usa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SECOES_CONTA } from "./secoes.ts";

const NOME = "Como você usa a Viva";

test("a seção tem UM nome: o do menu é o título (sem rótulo de menu diferente)", () => {
  const s = SECOES_CONTA.find((x) => x.id === "papeis")!;
  assert.equal(s.rotulo, NOME);
  assert.equal(s.rotuloMenu, undefined);
  assert.equal(s.href, "/dashboard/conta/papeis");
  // Nenhuma seção tem menu com nome diferente do título.
  for (const x of SECOES_CONTA) assert.ok(!x.rotuloMenu || x.rotuloMenu === x.rotulo, x.id);
});

test("o título do bloco na tela usa o mesmo nome (e o antigo some das telas)", () => {
  const bloco = readFileSync("src/components/account/seus-papeis.tsx", "utf8");
  assert.match(bloco, new RegExp(`>\\s*${NOME}\\s*</h2>`));
  for (const f of ["src/components/account/seus-papeis.tsx", "src/components/account/tela-papeis.tsx", "src/lib/conta/secoes.ts"]) {
    const s = readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    assert.doesNotMatch(s, /Papéis e intenção/, f);
  }
});
