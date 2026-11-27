/*
  E774 (família E764, regra E445) — Parceiros não sugere contato revelado depois do aceite: contato NUNCA é trocado.
  Roda: node --test src/lib/parceiros/e774-contato-parceiros.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTATO_PELA_VIVA } from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const SUPERFICIES = [
  "src/app/(public)/parceiros/[slug]/page.tsx",
  "src/app/(public)/parceiros/buscar/page.tsx",
  "src/app/(public)/parceiros/fotografos/page.tsx",
  "src/components/parceiros/selos-confianca.tsx",
  "src/lib/atendimento/parceiros-texto.ts",
  "src/lib/parceiros/regras.ts",
];
// Qualquer texto que sugira contato (ou contato + endereço) liberado/revelado depois do aceite.
const REVELACAO = /contato(?: e endere[cç]o)?(?: do (?:im[óo]vel|propriet[áa]rio))?[^.\n"]{0,40}(?:s[óo] depois do aceite|(?:s[óo] )?(?:são|é) liberad[oa]s?)/i;

test("nenhuma das superfícies de Parceiros diz que o contato é liberado/revelado depois do aceite", () => {
  for (const f of SUPERFICIES) assert.doesNotMatch(ler(f), REVELACAO, f);
});

test("o texto novo diz a regra vigente (contato não é trocado) e a fonte única é usada na página de fotógrafos", () => {
  assert.match(CONTATO_PELA_VIVA, /contato não é trocado/);
  assert.doesNotMatch(CONTATO_PELA_VIVA, REVELACAO);
  assert.match(ler("src/app/(public)/parceiros/fotografos/page.tsx"), /\{CONTATO_PELA_VIVA\}/);
  assert.match(ler("src/components/parceiros/selos-confianca.tsx"), /Seu contato não é trocado/);
  assert.match(ler("src/app/(public)/parceiros/[slug]/page.tsx"), /Seu contato não é trocado\./);
  assert.match(ler("src/app/(public)/parceiros/buscar/page.tsx"), /o seu contato não é trocado/);
  assert.match(ler("src/lib/atendimento/parceiros-texto.ts"), /o seu contato não é trocado/);
});

test("a resposta do chat da Viva sobre parceiros (CONTATO_NO_ACEITE) segue a regra: contato não é trocado, só o endereço chega após o aceite", async () => {
  const { CONTATO_NO_ACEITE } = await import("../atendimento/parceiros-texto.ts");
  assert.match(CONTATO_NO_ACEITE, /contato direto do proprietário não é trocado/);
  assert.doesNotMatch(CONTATO_NO_ACEITE, REVELACAO);
});
