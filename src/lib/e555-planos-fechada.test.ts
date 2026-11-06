/**
 * E555 + E563 — com os preços SUSPENSOS (chave PRECOS_VISIVEL desligada, o padrão), /planos e /precos não podem
 * aparecer em lugar nenhum: nem em llms.txt, nem no prompt da assistente, nem como link de fonte do comparativo,
 * nem na oferta do JSON-LD. A página e o conteúdo ficam no código; ligar a chave devolve tudo junto. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRECOS_VISIVEL } from "../config/precos-visivel.ts";
import { llmsTxt, llmsFullTxt } from "./seo/llms.ts";
import { SYSTEM_VIVA } from "./atendimento/viva-prompt.ts";
import { servicoProprietarios } from "./seo/estruturados.ts";
import { GUIAS } from "./guias/guias.ts";
import { FAQ } from "./atendimento/faq.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("o padrão do ambiente de teste é a chave DESLIGADA", () => {
  assert.equal(PRECOS_VISIVEL, false);
});

test("llms.txt e llms-full.txt não indicam /precos nem /planos com a chave desligada", () => {
  for (const t of [llmsTxt("https://x.test"), llmsFullTxt("https://x.test")]) {
    assert.doesNotMatch(t, /\/(precos|planos)\b/);
    assert.match(t, /\/para-proprietarios/, "as outras páginas continuam");
  }
});

test("o prompt da assistente não manda indicar /precos com a chave desligada", () => {
  assert.doesNotMatch(SYSTEM_VIVA, /\/precos/);
  assert.match(SYSTEM_VIVA, /\/como-funciona, \/seguranca, \/ajuda/);
});

test("FAQ da Central de Ajuda e guias públicos não mandam ninguém para /precos com a chave desligada", () => {
  assert.doesNotMatch(JSON.stringify(FAQ.map((f) => f.resposta)), /\/precos/);
  assert.doesNotMatch(JSON.stringify(GUIAS), /\/precos/);
});

test("a oferta do JSON-LD de /anunciar aponta para a própria página com a chave desligada", () => {
  const s = servicoProprietarios("https://x.test", []);
  assert.equal(s.offers.url, "https://x.test/para-proprietarios");
});

test("a fonte interna do comparativo só vira link com a chave ligada", () => {
  const src = ler("components/precos/comparativo-precos.tsx");
  assert.match(src, /interna && !PRECOS_VISIVEL \?/);
});

test("o conteúdo de /precos continua no código (volta junto ao religar)", () => {
  assert.match(ler("app/(public)/precos/page.tsx"), /eyebrow="Preços"/);
});
