/*
  E973 (cosmético, devolvido pela Fable no E398) — a coluna "Para" dos e-mails do admin (/admin/emails-teste e a caixa da
  conta) quebrava o endereço no meio da palavra ("a•••@lab.vivanomads.tes" / "t"): a coluna tem 176 px e break-words
  corta onde calhar. Agora o endereço só quebra nos pontos naturais — depois do "@" e antes de cada ponto.
  Roda: node --test src/lib/admin/e973-coluna-para.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pedacosDoEndereco } from "./endereco-email.ts";

test("E973 — o endereço vira pedaços que só quebram depois do @ e antes de cada ponto; juntos, é o mesmo texto", () => {
  assert.deepEqual(pedacosDoEndereco("a•••@lab.vivanomads.test"), ["a•••@", "lab", ".vivanomads", ".test"]);
  assert.deepEqual(pedacosDoEndereco("ana.souza@exemplo.com.br"), ["ana", ".souza@", "exemplo", ".com", ".br"]);
  for (const e of ["a•••@lab.vivanomads.test", "•••", "", "x@y"]) assert.equal(pedacosDoEndereco(e).join(""), e);
});

test("E973 — a coluna 'Para' (tabela e cartão) desenha os pedaços com <wbr> e sem break-words", () => {
  const p = readFileSync("src/components/admin/lista-emails-teste.tsx", "utf8");
  assert.equal((p.match(/<EnderecoQuebravel /g) ?? []).length, 2, "tabela e cartão");
  assert.doesNotMatch(p, /<td className="break-words py-2 pr-2">\{qa && l\.destinatario/);
  const c = readFileSync("src/components/admin/endereco-quebravel.tsx", "utf8");
  assert.match(c, /<wbr \/>/);
});
