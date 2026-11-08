/*
  E691 — o avaliador e o dono VEEM o número e o hash da assinatura do laudo (antes só a página pública prometia). Atrás de
  VISTORIA_ATIVA (as duas telas já só existem com a chave ligada). Roda: node --test src/lib/vistoria/e691-selo-assinatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seloDaAssinatura, hashCurto } from "./telas-laudo.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const HASH = "a".repeat(20) + "b".repeat(44);

test("E691: o selo mostra número, versão, quando assinou e o hash (curto na tela, inteiro para copiar)", () => {
  const s = seloDaAssinatura({ numero: "VIS-2026-000012", versao: 2, assinadoEm: "2026-11-07T15:30:00-03:00", assinaturaHash: HASH });
  assert.ok(s);
  assert.equal(s.numero, "VIS-2026-000012 v2");
  assert.equal(s.hash, HASH);
  assert.equal(s.hashCurto, `${"a".repeat(8)}…${"b".repeat(8)}`);
  assert.match(s.quando, /07\/11\/2026/);
});

test("E691: laudo sem assinatura (anterior ao E648) não ganha selo; hash curto de texto pequeno fica como está", () => {
  assert.equal(seloDaAssinatura({ numero: "VIS-1", versao: 1, assinadoEm: null, assinaturaHash: null }), null);
  assert.equal(hashCurto("abc"), "abc");
});

test("E691: o painel do avaliador e o bloco do dono leem as colunas e montam o selo", () => {
  const av = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(av, /assinado_em, assinatura_hash/);
  assert.match(av, /<SeloAssinatura /);
  const dono = ler("src/components/vistoria/laudo-dono.tsx");
  assert.match(dono, /assinado_em, assinatura_hash/);
  assert.match(dono, /<SeloAssinatura /);
  const comp = ler("src/components/vistoria/selo-assinatura.tsx");
  assert.match(comp, /data-testid="selo-assinatura"/);
  assert.match(comp, /data-testid="selo-assinatura-hash"/);
});
