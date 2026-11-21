/*
  E1007 (Gerente, ronda 21:49 de 16/11/2026) — "Meus dados" não rolava até a seção Documento.
  /dashboard/conta/dados#documento abria no topo: a seção é desenhada depois do carregamento (o navegador só rola até a
  âncora que já existe quando a página chega) e os blocos de cima ainda mudam de altura depois. Medido com sessão aberta:
  rolagem em 0 e o topo da seção em 1123 px (tela de 844, a 390 px) e 1141 px (tela de 900, a 1280 px).
  A tela "Meus dados" passa a levar a seção da âncora para a vista e a mantê-la lá enquanto a página assenta, sem nunca
  disputar a rolagem com a pessoa.
  Roda: node --test src/lib/conta/e1007-rolar-ate-ancora.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { JANELA_DE_ASSENTO_MS, ancoraParaRolar } from "./rolar-ate-ancora.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

test("âncora simples vira o id da seção; o resto não rola nada", () => {
  assert.equal(ancoraParaRolar("#documento"), "documento");
  assert.equal(ancoraParaRolar("#celular"), "celular");
  assert.equal(ancoraParaRolar("#secao-regras_2"), "secao-regras_2");
  for (const h of ["", "#", "documento", "#a b", "#a/b", "#access_token=x&type=recovery", "#" + "a".repeat(65), "#a%20b", "#<img>"]) assert.equal(ancoraParaRolar(h), null, h);
});

test("a janela de assento é curta: a tela não fica segurando a rolagem", () => {
  assert.ok(JANELA_DE_ASSENTO_MS >= 2000 && JANELA_DE_ASSENTO_MS <= 6000, String(JANELA_DE_ASSENTO_MS));
});

test("o componente leva a seção à vista, acompanha a página assentar e solta ao primeiro gesto da pessoa", () => {
  const c = ler("src/components/account/rolar-ate-ancora.tsx");
  assert.match(c, /^"use client";/);
  assert.match(c, /ancoraParaRolar\(window\.location\.hash\)/);
  assert.match(c, /scrollIntoView\(\{ block: "start" \}\)/, "respeita a margem de rolagem da seção (scroll-mt)");
  assert.match(c, /new MutationObserver\(/, "a seção aparece e os blocos de cima mudam depois do carregamento");
  assert.match(c, /JANELA_DE_ASSENTO_MS/);
  for (const gesto of ["wheel", "touchstart", "keydown", "pointerdown"]) assert.ok(c.includes(`"${gesto}"`), `solta no gesto ${gesto}`);
  assert.match(c, /addEventListener\("hashchange"/, "vale também para a âncora trocada com a tela aberta");
  // Sem foco forçado e sem rolagem animada: só a posição.
  assert.doesNotMatch(c, /behavior: "smooth"|\.focus\(/);
});

test("só a tela Meus dados usa o componente (as âncoras documento e celular moram nela)", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/conta/[secao]/page.tsx");
  const dados = pagina.slice(pagina.indexOf('case "dados":'), pagina.indexOf('case "privacidade":'));
  assert.match(dados, /<RolarAteAncora \/>/);
  assert.equal((pagina.match(/<RolarAteAncora \/>/g) ?? []).length, 1);
  assert.match(ler("src/components/account/conta-secoes.tsx"), /<section id="documento" className="scroll-mt-24"/);
});
