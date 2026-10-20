/* Roda: node --test src/lib/polos.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { POLOS, acharPolo, tituloDoPolo, bairroNoPolo, imoveisDoPolo, perguntasDoPolo, polosDaCidade } from "./polos.ts";

test("polos de Uberlândia existem e slugs são únicos", () => {
  assert.equal(polosDaCidade("uberlandia").length >= 2, true);
  assert.equal(new Set(POLOS.map((p) => `${p.cidade}/${p.slug}`)).size, POLOS.length);
  assert.equal(acharPolo("uberlandia", "nao-existe"), null);
});

test("bairro casa sem acento nem maiúscula; outro bairro fica fora", () => {
  const p = acharPolo("uberlandia", "ufu-santa-monica")!;
  assert.equal(bairroNoPolo(p, "santa monica"), true);
  assert.equal(bairroNoPolo(p, "Centro"), false);
  assert.equal(bairroNoPolo(p, ""), false);
  assert.equal(imoveisDoPolo(p, [{ neighborhood: "Santa Mônica" }, { neighborhood: "Centro" }]).length, 1);
});

test("FAQ não inventa preço: sem média diz que faltam anúncios", () => {
  const p = POLOS[0];
  const sem = perguntasDoPolo(p, "Uberlândia", null).map((x) => x.a).join(" ");
  assert.match(sem, /pelo menos 3 anúncios/);
  assert.doesNotMatch(sem, /R\$/);
  assert.match(perguntasDoPolo(p, "Uberlândia", 2500).map((x) => x.a).join(" "), /R\$ 2\.500/);
});

test("texto público dos polos evita palavras proibidas", () => {
  const txt = JSON.stringify([POLOS, perguntasDoPolo(POLOS[0], "Uberlândia", 2000)]);
  assert.doesNotMatch(txt, /aluguel|alugue|comiss|corretag|intermedi|vistoria|temporada|art\. ?48/i);
});

test("título do polo só minusculiza a 1ª letra: siglas e nomes próprios ficam como estão (lab t117)", () => {
  assert.equal(tituloDoPolo("Perto do HC-UFU e Umuarama"), "perto do HC-UFU e Umuarama");
  assert.equal(tituloDoPolo(POLOS[0].nome).includes("HC-UFU"), true);
  assert.equal(tituloDoPolo(""), "");
});
