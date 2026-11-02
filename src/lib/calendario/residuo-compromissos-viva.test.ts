/*
  Resíduo da varredura de funções — compromissosDaViva (baixo): os compromissos da Viva (contratos, propostas e
  candidaturas) que o calendário importado confere para avisar o dono de conflito. Cada leitura engolia o erro: na
  falha de uma, a lista saía PARCIAL e a rodada avisava só parte dos conflitos, como se tivesse conferido tudo. Agora
  é tudo ou nada: qualquer leitura que falha LANÇA, e a sincronia pula os avisos de conflito nesta rodada (a próxima,
  em 3 h, confere de novo; o aviso é uma vez por conflito, então nada se repete).
  Roda: node --test src/lib/calendario/residuo-compromissos-viva.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./importar-servidor.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function compromissosDaViva"), src.indexOf("\n}\n", src.indexOf("export async function compromissosDaViva")));

test("compromissosDaViva é tudo ou nada: cada leitura que falha lança", () => {
  assert.doesNotMatch(fn, /periodosOcupados\(admin, propertyId\)\.catch\(/, "a falha dos contratos não vira lista vazia");
  for (const [rotulo, re] of [
    ["propostas", /const \{ data: props, error: erroProps \} = await admin/],
    ["versões", /const \{ data: v, error: erroVersao \} = await admin\.from\("proposta_versoes"\)/],
    ["candidaturas", /const \{ data: leads, error: erroLeads \} = await admin\.from\("leads"\)/],
  ] as const) assert.match(fn, re, rotulo);
  for (const e of ["erroProps", "erroVersao", "erroLeads"]) assert.match(fn, new RegExp(`if \\(${e}\\) throw new Error\\(`), e);
});

test("a sincronia pula os avisos de conflito nesta rodada quando os compromissos não foram lidos", () => {
  assert.match(src, /const compromissos = await compromissosDaViva\(admin, imp\.property_id\)\.catch\(\(\) => null\);/);
  assert.match(src, /const lista = compromissos \? conflitosComViva\(importados, compromissos\) : \[\];/);
});
