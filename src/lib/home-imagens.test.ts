import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { quantosDestaques, HOME_PASSOS_IMAGENS, HOME_PROPRIETARIOS_FUNDO } from "./home-imagens.ts";

test("H2: 4 destaques com 4 ou mais imóveis; 2 com menos; nunca ímpar", () => {
  assert.equal(quantosDestaques(10), 4);
  assert.equal(quantosDestaques(4), 4);
  assert.equal(quantosDestaques(3), 2);
  assert.equal(quantosDestaques(2), 2);
  assert.equal(quantosDestaques(0), 0);
});

test("H1/H4: slots com os nomes combinados; marcados prontos só se o arquivo existe", () => {
  assert.equal(HOME_PASSOS_IMAGENS.length, 4);
  // QA do Muse (18/10): os 4 passos com as fotos reais de /como-funciona, todas prontas e existentes.
  assert.equal(HOME_PASSOS_IMAGENS[0].src, "/images/como-funciona/01-busque.webp");
  assert.ok(HOME_PASSOS_IMAGENS.every((i) => i.pronta));
  assert.equal(HOME_PROPRIETARIOS_FUNDO.src, "/images/unicas/home-proprietarios-fundo.webp");
  for (const i of [...HOME_PASSOS_IMAGENS, HOME_PROPRIETARIOS_FUNDO]) {
    if (i.pronta) assert.ok(existsSync(`public${i.src}`), `${i.src} marcado pronto mas não existe`);
  }
});

const home = readFileSync(new URL("../app/(public)/page.tsx", import.meta.url), "utf8");

test("H3: faixa de confiança tem os 4 selos reais, sem citar lei", () => {
  for (const t of [
    "Contato protegido até o aceite",
    "Caução documentada",
    "Documentação do imóvel conferida",
    "R$ 0 de taxa para o morador",
  ])
    assert.ok(home.includes(t), t);
  assert.doesNotMatch(home, /art\. ?48|8\.245/i);
});

test("H1: 4 passos, o 4º é Conferência de entrada (nunca vistoria)", () => {
  assert.match(home, /Do anúncio ao contrato em 4 passos/);
  assert.match(home, /title="Conferência de entrada"/);
  assert.doesNotMatch(home, /vistoria/i);
});

test("QA do Muse: nenhum \"Foto do passo em breve\" na home", () => {
  assert.ok(!home.includes("Foto do passo em breve"));
});
