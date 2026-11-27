/*
  E897 (prova L-004, PROVADO): em /parceiros o cartão "Limpeza e manutenção" fala de limpeza, lavanderia, reparos e
  manutenção, mas os dois caminhos ("Quero atender" / "Procurar") levavam só a Limpeza. Manutenção e Lavanderia têm busca
  própria, sem link a partir do cartão. Agora o cartão segue o padrão do vizinho "Montagem e mudança" (E301): um caminho
  por categoria, para atender e para procurar. Roda: node --test src/lib/parceiros/e897-cartao-limpeza.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATEGORIAS_CARTAO_SERVICOS, linksDoCartaoServicos } from "./cartao-servicos.ts";
import { categoriaValida } from "./regras.ts";

test("E897: o cartão cobre limpeza, lavanderia e manutenção — atender e procurar cada uma", () => {
  assert.deepEqual(CATEGORIAS_CARTAO_SERVICOS, ["limpeza", "lavanderia", "manutencao"]);
  for (const c of CATEGORIAS_CARTAO_SERVICOS) assert.ok(categoriaValida(c), c);
  const hrefs = linksDoCartaoServicos().map((l) => l.href);
  for (const c of CATEGORIAS_CARTAO_SERVICOS) {
    assert.ok(hrefs.includes(`/parceiros?categoria=${c}#quero-ser-parceiro`), `atender ${c}`);
    assert.ok(hrefs.includes(`/parceiros/buscar?categoria=${c}`), `procurar ${c}`);
  }
  assert.equal(new Set(hrefs).size, hrefs.length, "sem link repetido");
  assert.deepEqual(linksDoCartaoServicos().map((l) => l.rotulo), [
    "Atender limpeza", "Atender lavanderia", "Atender manutenção", "Procurar limpeza", "Procurar lavanderia", "Procurar manutenção",
  ]);
});

test("E897: /parceiros usa a função no cartão 'Limpeza e manutenção'", () => {
  const p = readFileSync(new URL("../../app/(public)/parceiros/page.tsx", import.meta.url), "utf8");
  const card = p.slice(p.indexOf('id: "servicos"'), p.indexOf('id: "mobilia"'));
  assert.match(card, /links: linksDoCartaoServicos\(\)/);
  assert.doesNotMatch(card, /rotulo: "Quero atender"/);
});
