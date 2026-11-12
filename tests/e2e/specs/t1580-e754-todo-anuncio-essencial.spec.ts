import { test, expect } from "@playwright/test";
import { SAMPLE_PROPERTIES } from "../../../src/lib/properties";
import { graduarExemplo } from "../../../src/lib/niveis/nivel-exemplo";

/*
  T1580 — E754 (#3556): todo anúncio carrega ao menos Essencial, igual no detalhe e nos cartões — os exemplos fecham os 12 itens e o nível sai do motor
  (nada escrito à mão): nenhum sem nível, nenhum Conforto/Premium sem foto na hora e sem medição. Só lógica, roda no lab-crítico.
*/
test("E754: os exemplos são todos Essencial e fecham os 12 itens", () => {
  expect(SAMPLE_PROPERTIES.filter((p) => !p.nivel)).toHaveLength(0);
  expect(SAMPLE_PROPERTIES.filter((p) => p.nivel !== "essencial").map((p) => p.id)).toEqual([]);
  for (const p of SAMPLE_PROPERTIES) expect(graduarExemplo(p).faltam, p.id).toEqual([]);
});
