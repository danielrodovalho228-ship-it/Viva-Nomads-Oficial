/*
  Padrão E56 — bloco opcional: nasce fechado; ligar abre; com dados salvos nasce aberto; desligar com dados pede
  confirmação; no medidor, desligado = "não se aplica". Roda: node --test src/lib/anuncio/bloco-opcional.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aoTocarToggle, completudeBlocos, nasceLigado, textoCompletude } from "./bloco-opcional.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("1 e 3: sem dado salvo nasce fechado; com dado salvo nasce aberto", () => {
  assert.equal(nasceLigado(false), false);
  assert.equal(nasceLigado(true), true);
});

test("2 e 4: ligar abre; desligar vazio desliga direto; desligar com dados pede confirmação", () => {
  assert.equal(aoTocarToggle(false, false), "ligar");
  assert.equal(aoTocarToggle(false, true), "ligar");
  assert.equal(aoTocarToggle(true, false), "desligar");
  assert.equal(aoTocarToggle(true, true), "confirmar");
});

test("medidor: desligado é 'não se aplica' — não conta como feito nem como falta", () => {
  const c = completudeBlocos([
    { chave: "a", ligado: true, preenchido: true },
    { chave: "b", ligado: true, preenchido: true },
    { chave: "c", ligado: true, preenchido: false },
    { chave: "d", ligado: false, preenchido: false },
    { chave: "e", ligado: false, preenchido: false },
    { chave: "f", ligado: false, preenchido: false },
  ]);
  assert.deepEqual(c, { feitos: 2, faltam: 1, naoSeAplica: 3, pct: 67 });
  assert.equal(textoCompletude(c), "2 de 3 preenchidos · 3 não se aplicam");
  const nada = completudeBlocos([{ chave: "a", ligado: false, preenchido: false }]);
  assert.equal(nada.pct, 100, "nada ligado = nada pendente");
  assert.equal(textoCompletude(nada), "Nenhum detalhe opcional ligado · 1 não se aplica");
  assert.equal(textoCompletude(completudeBlocos([{ chave: "a", ligado: true, preenchido: true }])), "1 de 1 preenchido");
});

test("componente: toggle acessível (switch), confirmação na própria tela e conteúdo só quando ligado", () => {
  const c = ler("components/anuncio/bloco-opcional.tsx");
  assert.match(c, /role="switch"/);
  assert.match(c, /aria-checked=\{ligado\}/);
  assert.match(c, /role="alertdialog"/);
  assert.doesNotMatch(c, /window\.confirm|confirm\(/, "sem diálogo do navegador");
  assert.match(c, /\{ligado && \(/);
  assert.match(c, /aoTocarToggle\(ligado, temDados\)/);
});
