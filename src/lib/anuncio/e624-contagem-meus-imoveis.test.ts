/*
  E624 (ressalva da prova do E511, 05/11): em Meus imóveis os contadores divergiam na mesma tela — abas 29, "Mostrar
  mais (12 de 17)" / "(5 de 5)" e 31 com as cópias de rascunho abertas. A unidade agora é o ANÚNCIO em toda superfície.
  Roda: node --test src/lib/anuncio/e624-contagem-meus-imoveis.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { POR_PAGINA, abasVisiveis, anunciosDaLista, juntarCopiasAoPai, paginarAnuncios, textoContagemLista, textoMostrarMais } from "./lista-meus-imoveis.ts";

type It = { id: string; status: "active" | "paused" | "draft"; title: string };
// O caso da prova: 29 anúncios + 2 cópias de um rascunho (31 linhas no banco).
const anuncios: It[] = Array.from({ length: 29 }, (_, i) => ({ id: `a${i}`, status: i < 5 ? "active" : "draft", title: `Imóvel ${i}` }));
const copias = new Set(["c1", "c2"]);
const copiasDe = new Map([["a10", ["c1", "c2"]]]);
const todas: It[] = [...anuncios, { id: "c1", status: "draft", title: "Imóvel 10" }, { id: "c2", status: "draft", title: "Imóvel 10" }];

test("E624: as abas contam anúncios — 29, com as cópias fechadas ou abertas", () => {
  const n = abasVisiveis(anunciosDaLista(todas, copias)).find((a) => a.id === "todos")!.n;
  assert.equal(n, 29);
});

test("E624: a página conta anúncios; as cópias abertas vêm com o pai e não ocupam vaga", () => {
  const aberta = juntarCopiasAoPai(todas, copiasDe); // a10, c1, c2 juntos
  const p1 = paginarAnuncios(aberta, copias, 1);
  assert.equal(p1.mostrados, POR_PAGINA);
  assert.equal(p1.total, 29);
  assert.equal(p1.restantes, 17);
  assert.ok(p1.visiveis.some((i) => i.id === "c1") && p1.visiveis.some((i) => i.id === "c2"), "a10 está na 1ª página: as cópias vêm junto");
  assert.equal(p1.visiveis.length, POR_PAGINA + 2);
  const p3 = paginarAnuncios(aberta, copias, 3);
  assert.deepEqual([p3.mostrados, p3.total, p3.restantes], [29, 29, 0]);
  // com as cópias fechadas (fora da lista), o total é o mesmo
  assert.equal(paginarAnuncios(anuncios, copias, 1).total, 29);
});

test("E624: o mesmo número em toda superfície — 'Mostrando 12 de 29 imóveis', 'Mostrar mais 12', depois '29 imóveis'", () => {
  const aberta = juntarCopiasAoPai(todas, copiasDe);
  // 2ª prova: com as cópias abertas a frase as nomeia (os cartões na tela = anúncios + cópias).
  assert.equal(textoContagemLista(paginarAnuncios(aberta, copias, 1)), "Mostrando 12 de 29 imóveis (+ 2 cópias de rascunho abertas)");
  assert.equal(textoMostrarMais(paginarAnuncios(aberta, copias, 1).restantes), "Mostrar mais 12");
  assert.equal(textoMostrarMais(paginarAnuncios(aberta, copias, 2).restantes), "Mostrar mais 5");
  assert.equal(textoContagemLista(paginarAnuncios(aberta, copias, 3)), "29 imóveis (+ 2 cópias de rascunho abertas)");
  assert.equal(textoContagemLista(paginarAnuncios(anuncios, copias, 3)), "29 imóveis");
  assert.equal(textoContagemLista({ mostrados: 1, total: 1 }), "1 imóvel");
});

test("E624: a tela lê a contagem única (abas, contagem e botão)", () => {
  const c = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", import.meta.url), "utf8");
  assert.match(c, /const anuncios = anunciosDaLista\(properties, copias\);/);
  assert.match(c, /const abas = abasVisiveis\(anuncios\);/);
  assert.match(c, /paginarAnuncios\(filtrada, copias, paginas\)/);
  assert.match(c, /\{textoContagemLista\(pagina\)\}/);
  assert.match(c, /\{textoMostrarMais\(pagina\.restantes\)\}/);
  assert.doesNotMatch(c, /filtrada\.length/);
});

/*
  E624 (reprovado de novo em 05/11): com as 3 cópias reveladas a tela tinha 32 cartões, mas a contagem dizia 29 e nenhuma
  superfície mencionava as cópias ("as cópias reveladas não entram em contagem nenhuma"). A fonte é uma só: paginarAnuncios
  devolve também quantas cópias estão abertas, e a MESMA frase de contagem as nomeia — 29 anúncios + 3 cópias = 32 cartões.
*/
const aVinte9Mais3: It[] = [...anuncios, { id: "c1", status: "draft", title: "Imóvel 10" }, { id: "c2", status: "draft", title: "Imóvel 10" }, { id: "c3", status: "draft", title: "Imóvel 10" }];
const copias3 = new Set(["c1", "c2", "c3"]);
const copiasDe3 = new Map([["a10", ["c1", "c2", "c3"]]]);

test("E624: a página diz quantas cópias abertas aparecem — os cartões desenhados batem com anúncios + cópias", () => {
  const aberta = juntarCopiasAoPai(aVinte9Mais3, copiasDe3);
  const p1 = paginarAnuncios(aberta, copias3, 1);
  assert.equal(p1.copiasAbertas, 3);
  assert.equal(p1.mostrados + p1.copiasAbertas, p1.visiveis.length);
  const p3 = paginarAnuncios(aberta, copias3, 3);
  assert.deepEqual([p3.total, p3.copiasAbertas, p3.visiveis.length], [29, 3, 32]);
  // fechadas: a lista nem recebe as cópias → 0, e o texto é o de sempre
  const fechada = paginarAnuncios(anuncios, copias3, 3);
  assert.equal(fechada.copiasAbertas, 0);
  assert.equal(textoContagemLista(fechada), "29 imóveis");
});

test("E624: a frase de contagem nomeia as cópias abertas, no singular e no plural", () => {
  const aberta = juntarCopiasAoPai(aVinte9Mais3, copiasDe3);
  assert.equal(textoContagemLista(paginarAnuncios(aberta, copias3, 3)), "29 imóveis (+ 3 cópias de rascunho abertas)");
  assert.equal(textoContagemLista(paginarAnuncios(aberta, copias3, 1)), "Mostrando 12 de 29 imóveis (+ 3 cópias de rascunho abertas)");
  assert.equal(textoContagemLista({ mostrados: 5, total: 5, copiasAbertas: 1 }), "5 imóveis (+ 1 cópia de rascunho aberta)");
  assert.equal(textoContagemLista({ mostrados: 5, total: 5, copiasAbertas: 0 }), "5 imóveis");
  assert.equal(textoContagemLista({ mostrados: 5, total: 5 }), "5 imóveis");
});

test("E624: a tela só repassa o objeto da página à frase (nenhuma conta própria de cartões)", () => {
  const c = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/imoveis-client.tsx", import.meta.url), "utf8");
  assert.match(c, /\{textoContagemLista\(pagina\)\}/);
  assert.doesNotMatch(c, /pagina\.visiveis\.length|properties\.length\s*\+/);
});
