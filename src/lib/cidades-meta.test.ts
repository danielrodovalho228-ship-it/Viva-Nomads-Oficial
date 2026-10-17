import test from "node:test";
import assert from "node:assert/strict";
import { descricaoCidade } from "./cidades-meta.ts";

// Ordem 7816ce3a: a meta description da cidade vai para Google/IA/redes — sem verbo "alugar".
test("descrição da cidade: cita o nome e a faixa de dias, sem 'Alugue'", () => {
  const d = descricaoCidade("Uberlândia");
  assert.match(d, /Uberlândia/);
  assert.match(d, /30 a 180 dias/);
  assert.match(d, /imóveis mobiliados/i);
  assert.doesNotMatch(d, /alugu?e|alugar|aluguel|temporada|art\. ?48|8\.245/i);
});
