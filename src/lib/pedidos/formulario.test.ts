/*
  Formulário do pedido de moradia (prompt 12): autocomplete de cidade, máscara do valor e contador.
  Roda: node --test src/lib/pedidos/formulario.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buscarCidades, fraseContador, lerCidadeUf, mascararMilhar, rotuloCidade, soDigitos } from "./formulario.ts";

const MUN: Record<string, string[]> = {
  MG: ["Belo Horizonte", "Uberaba", "Uberlândia", "Bom Jesus do Galho"],
  PI: ["Bom Jesus"],
  BA: ["Bom Jesus da Lapa"],
  RN: ["Bom Jesus"],
};

test("autocomplete: digitar sem acento acha a cidade com a UF no rótulo", () => {
  const r = buscarCidades(MUN, "uberl");
  assert.deepEqual(r, [{ cidade: "Uberlândia", uf: "MG", rotulo: "Uberlândia – MG" }]);
  assert.deepEqual(buscarCidades(MUN, "u"), [], "uma letra só não lista nada");
});

test("autocomplete: exato antes de 'começa com' antes de 'contém', com limite", () => {
  const r = buscarCidades(MUN, "bom jesus").map((c) => c.rotulo);
  assert.deepEqual(r.slice(0, 2).sort(), ["Bom Jesus – PI", "Bom Jesus – RN"]);
  assert.ok(r.indexOf("Bom Jesus da Lapa – BA") > 1);
  assert.equal(buscarCidades(MUN, "bom", 2).length, 2);
  assert.deepEqual(buscarCidades(MUN, "jesus – PI").map((c) => c.rotulo), ["Bom Jesus – PI"]);
});

test("lerCidadeUf: rótulo da lista grava cidade e UF; nome repetido sem UF fica em aberto", () => {
  assert.deepEqual(lerCidadeUf(MUN, "Uberlândia – MG"), { cidade: "Uberlândia", uf: "MG" });
  assert.deepEqual(lerCidadeUf(MUN, "uberlandia"), { cidade: "Uberlândia", uf: "MG" });
  assert.deepEqual(lerCidadeUf(MUN, "Bom Jesus/RN"), { cidade: "Bom Jesus", uf: "RN" });
  assert.equal(lerCidadeUf(MUN, "Bom Jesus"), null);
  assert.equal(lerCidadeUf(MUN, "Uberlândia – SP"), null);
  assert.equal(lerCidadeUf(MUN, ""), null);
  assert.equal(rotuloCidade("Uberaba", "MG"), "Uberaba – MG");
});

test("lista real do IBGE: Uberlândia e São Paulo achadas na lista inteira", () => {
  const ibge = JSON.parse(readFileSync(new URL("../../data/municipios-ibge.json", import.meta.url), "utf8")) as Record<string, string[]>;
  assert.ok(Object.values(ibge).reduce((n, l) => n + l.length, 0) > 5500);
  assert.equal(buscarCidades(ibge, "uberlandia")[0].rotulo, "Uberlândia – MG");
  assert.equal(buscarCidades(ibge, "sao paulo")[0].rotulo, "São Paulo – SP");
  assert.deepEqual(lerCidadeUf(ibge, "São Paulo – SP"), { cidade: "São Paulo", uf: "SP" });
});

test("máscara do valor: milhar com ponto, só dígitos", () => {
  assert.equal(mascararMilhar("3500"), "3.500");
  assert.equal(mascararMilhar("R$ 12.000,"), "12.000");
  assert.equal(mascararMilhar("950"), "950");
  assert.equal(mascararMilhar("0035"), "35");
  assert.equal(mascararMilhar(""), "");
  assert.equal(soDigitos("3.500"), "3500");
  assert.equal(soDigitos("123456789"), "1234567");
});

test("contador do rodapé: frase discreta, singular/plural e zero", () => {
  assert.equal(fraseContador(1), "1 imóvel combina com seu pedido agora");
  assert.equal(fraseContador(7), "7 imóveis combinam com seu pedido agora");
  assert.equal(fraseContador(0), "Nenhum imóvel ainda — seu pedido avisa quando entrar um");
});
