/* Grade par (31/10) e conformidade parceiro-cadastro (01/11): no "Quero ser parceiro", as categorias com foto são
   cartões com foto em grade par (2/3 para as 6 fotos); a sem foto ("Outro serviço") fica numa linha inteira.
   Roda: node --test src/components/parceiros/categorias-grade-par.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const c = readFileSync(new URL("./seja-parceiro-form.tsx", import.meta.url), "utf8");
const fotos = readFileSync(new URL("../../config/fotos-categorias-parceiro.ts", import.meta.url), "utf8");
const regras = readFileSync(new URL("../../lib/parceiros/regras.ts", import.meta.url), "utf8");

test("categorias do Seja parceiro: cartões com foto em grade par (2 no celular, 3 no computador)", () => {
  assert.match(c, /className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="sp-categorias"/);
  assert.match(c, /CATEGORIAS_CATALOGO\.filter\(\(k\) => fotoDaCategoria\(k\.valor\)\)/);
  assert.match(c, /has-checked:border-forest/);
  // Quantas categorias do catálogo têm foto: precisa ser múltiplo de 2 e de 3 para a grade fechar par nas duas larguras.
  const catalogo = [...regras.matchAll(/\{ valor: "(\w+)", rotulo/g)].map((m) => m[1]).filter((v) => v !== "vistoria");
  const comFoto = catalogo.filter((v) => new RegExp(`^\\s+${v}: \\{ src:`, "m").test(fotos));
  assert.equal(comFoto.length % 6, 0, `categorias com foto: ${comFoto.join(", ")}`);
});

test("toggles do Seja parceiro no verde da marca (nada de azul)", () => {
  assert.doesNotMatch(c, /blue-/);
  assert.match(c, /"border-forest bg-sage-100 text-forest"/);
});
