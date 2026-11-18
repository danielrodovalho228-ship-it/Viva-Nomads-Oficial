import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baseDoPertoDe } from "../perto-de.ts";

/*
  E889 🔴 (14/11): /imoveis-perto-de/<destino> abria VAZIA ("Ainda não há imóvel publicado perto…") enquanto a página da
  região (polo) mostrava os anúncios: a lista descartava TODO anúncio de exemplo, e a região usa a base da vitrine
  (exemplos enquanto não há real; só reais quando houver). Regra: a lista por tempo lê a MESMA base da região/busca.
*/
type I = { id: string; city: string; title: string };
const ex = (id: string): I => ({ id: `ube-${id}`, city: "Uberlândia", title: `Exemplo ${id}` });
const real = (id: string, city = "Uberlândia"): I => ({ id, city, title: `Apto ${id}` });
const ehExemplo = (i: I) => i.id.startsWith("ube-");

test("só exemplos na cidade (pré-lançamento): a lista mostra os exemplos, como a região", () => {
  const r = baseDoPertoDe([ex("001"), ex("002"), real("x", "Uberaba")], "Uberlândia", ehExemplo);
  assert.deepEqual(r.map((i) => i.id), ["ube-001", "ube-002"]);
});

test("com imóvel real na cidade: só os reais (os exemplos saem, como na busca)", () => {
  const r = baseDoPertoDe([ex("001"), real("a"), real("b", "Uberaba")], "Uberlândia", ehExemplo);
  assert.deepEqual(r.map((i) => i.id), ["a"]);
});

test("anúncio de teste nunca entra; outra cidade nunca entra", () => {
  const r = baseDoPertoDe([real("a"), { id: "t", city: "Uberlândia", title: "[TESTE] apto" }], "uberlandia", ehExemplo);
  assert.deepEqual(r.map((i) => i.id), ["a"]);
});

test("a página usa baseDoPertoDe (não um filtro próprio que descarta os exemplos)", () => {
  const pagina = readFileSync("src/app/(public)/imoveis-perto-de/[slug]/page.tsx", "utf8");
  assert.match(pagina, /baseDoPertoDe\(/);
  assert.doesNotMatch(pagina, /!isExemplo\(p\.id\)/);
});
