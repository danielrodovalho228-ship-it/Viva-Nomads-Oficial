/*
  E800 (D3): a pílula da prévia não quebra encostando nas bordas e o relógio não cobre o "Responde X%…".
  Roda: node --test src/components/account/e800-pilula-previa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PILULA_TITULO_ESPELHO, CAIXA_ICONE_ESPELHO, ICONE_PILULA_ESPELHO, LINHA_RESPOSTA_ESPELHO, ICONE_RESPOSTA_ESPELHO } from "./espelho-classes.ts";

test("a pílula tem folga lateral (px-4) e raio de 12 px — quebrada em duas linhas, o texto não encosta na curva", () => {
  assert.match(PILULA_TITULO_ESPELHO, /\bpx-4\b/);
  assert.match(PILULA_TITULO_ESPELHO, /\brounded-xl\b/);
  assert.doesNotMatch(PILULA_TITULO_ESPELHO, /rounded-full/);
  assert.match(PILULA_TITULO_ESPELHO, /\bitems-start\b/);
});

test("os ícones nunca encolhem e ficam na altura da 1ª linha (caixa h-5 = leading-5)", () => {
  for (const c of [ICONE_PILULA_ESPELHO, ICONE_RESPOSTA_ESPELHO, CAIXA_ICONE_ESPELHO]) assert.match(c, /\bshrink-0\b/);
  assert.match(CAIXA_ICONE_ESPELHO, /\bh-5\b/);
  assert.match(PILULA_TITULO_ESPELHO, /\bleading-5\b/);
  assert.match(LINHA_RESPOSTA_ESPELHO, /\bleading-5\b/);
  assert.match(LINHA_RESPOSTA_ESPELHO, /\bitems-start\b/);
});

test("as duas prévias (dono e morador) usam as mesmas classes", () => {
  const dono = readFileSync("src/components/account/espelho-papel.tsx", "utf8");
  const morador = readFileSync("src/components/account/espelho-perfil.tsx", "utf8");
  for (const s of [dono, morador]) {
    assert.match(s, /className=\{PILULA_TITULO_ESPELHO\} data-testid="espelho-titulo"/);
    assert.doesNotMatch(s, /rounded-full bg-forest px-3 py-2/);
  }
  assert.match(dono, /className=\{LINHA_RESPOSTA_ESPELHO\} data-testid="espelho-resposta"/);
  assert.match(dono, /<Clock className=\{ICONE_RESPOSTA_ESPELHO\} aria-hidden \/>/);
});
