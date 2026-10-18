import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoDaSugestao } from "./resumo-ia.ts";
import { AMENITY_LABEL } from "../amenities.ts";

test("resumo da IA: quartos, banheiros e comodidades do catálogo, no máximo 5 itens", () => {
  const chaves = Object.keys(AMENITY_LABEL).slice(0, 6);
  const r = resumoDaSugestao({ quartos: 2, banheiros: 1, comodidades: chaves });
  const partes = r.split(", ");
  assert.equal(partes.length, 5);
  assert.equal(partes[0], "2 quartos");
  assert.equal(partes[1], "1 banheiro");
});

test("resumo da IA: chave fora do catálogo não entra; nada achado → vazio", () => {
  assert.equal(resumoDaSugestao({ comodidades: ["nao_existe"] }), "");
  assert.equal(resumoDaSugestao({ quartos: 0 }), "studio (sem quarto separado)");
});
