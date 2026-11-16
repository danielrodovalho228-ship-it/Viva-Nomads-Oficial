/*
  T2071 — E971 (Pista 3; autorizado pelo Gerente na ronda 03:20Z) @E971 (unitário, sem rede)
  Regra decidida (coordenador, ORDEM-DUET-068 ponto 4): a foto enviada na conversa abre no LIGHTBOX DO COMPONENTE DA
  GALERIA do imóvel (o Lightbox de property-gallery.tsx) — NÃO numa aba nova. O PDF segue como "Abrir PDF".
  Esta trava prova, sem laboratório:
    1. a foto na bolha não é mais uma ligação que abre outra aba (nada de <a target="_blank"> no anexo-foto);
    2. o chat REUSA a galeria: o módulo da bolha (anexo-conversa.tsx, ou a tela de Mensagens que a desenha) importa
       @/components/property-gallery — nenhum lightbox próprio;
    3. o PDF não muda.
  O comportamento na tela (abrir, foto carregada, fechar pelo botão e pelo Esc, nos dois lados) é o t2021 (laboratório).
  Ponto de adaptação: se a correção puser o estado do lightbox noutro componente da conversa, a regra 2 aceita o import
  em messages-client.tsx (lido do código). Correção do Code 2 (Família 6). Vermelha na main até a correção entrar.
  Roda: node --test src/components/mensagens/e971-t2071-foto-do-chat-no-lightbox-da-galeria.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

register("./e971-harness/loader.mjs", import.meta.url);
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
const { AnexoNaMensagem } = await import("./anexo-conversa.tsx");

const FOTO = { id: "11111111-1111-4111-8111-111111111111", tipo: "foto", mime: "image/webp" };
const PDF = { id: "22222222-2222-4222-8222-222222222222", tipo: "pdf", mime: "application/pdf" };
const bolha = (anexo: object, minha = false) => renderToStaticMarkup(createElement(AnexoNaMensagem, { anexo, minha } as never));
/** A tag de abertura do elemento com aquele data-testid. */
const tagDe = (html: string, testId: string) => html.match(new RegExp(`<(\\w+)[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? null;

test("T2071 — E971: a foto da conversa não abre outra aba (dos dois lados da conversa)", () => {
  for (const minha of [true, false]) {
    const html = bolha(FOTO, minha);
    const tag = tagDe(html, "anexo-foto");
    assert.ok(tag, "a foto continua na bolha (data-testid=anexo-foto)");
    assert.doesNotMatch(tag!, /target="_blank"/, `a foto abre outra aba: ${tag}`);
    assert.doesNotMatch(tag!, /^<a\b[^>]*\bhref=/, `a foto é uma ligação que sai da conversa: ${tag}`);
    assert.match(html, /<img[^>]+alt="Foto enviada na conversa"/, "a miniatura segue na bolha");
  }
});

test("T2071 — E971: o chat reusa o lightbox da galeria do imóvel (nenhum lightbox próprio)", () => {
  const importouNoModulo = (globalThis as { __e971GaleriaImportada?: boolean }).__e971GaleriaImportada === true;
  const tela = readFileSync("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx", "utf8");
  const importouNaTela = /import\s*\{[^}]*\bLightbox\b[^}]*\}\s*from\s*["']@\/components\/property-gallery["']/.test(tela);
  assert.ok(importouNoModulo || importouNaTela, "nem anexo-conversa.tsx nem a tela de Mensagens usam o Lightbox de property-gallery");
});

test("T2071 — E971: o PDF segue como Abrir PDF", () => {
  const html = bolha(PDF);
  assert.match(html, /data-testid="anexo-pdf"/);
  assert.match(html.replace(/<[^>]+>/g, " "), /Abrir PDF/);
});
