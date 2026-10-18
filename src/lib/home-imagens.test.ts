import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { quantosDestaques, HOME_PROPRIETARIOS_FUNDO } from "./home-imagens.ts";

test("H2: 4 destaques com 4 ou mais imóveis; 2 com menos; nunca ímpar", () => {
  assert.equal(quantosDestaques(10), 4);
  assert.equal(quantosDestaques(4), 4);
  assert.equal(quantosDestaques(3), 2);
  assert.equal(quantosDestaques(2), 2);
  assert.equal(quantosDestaques(0), 0);
});

test("H4: fundo dos proprietários com o nome combinado; marcado pronto só se o arquivo existe", () => {
  assert.equal(HOME_PROPRIETARIOS_FUNDO.src, "/images/unicas/home-proprietarios-fundo.webp");
  if (HOME_PROPRIETARIOS_FUNDO.pronta) assert.ok(existsSync(`public${HOME_PROPRIETARIOS_FUNDO.src}`));
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

test("t112 (0f204e06): nenhum passo da home reaproveita foto de /como-funciona", () => {
  const comoFunciona = readFileSync(new URL("../app/(public)/como-funciona/page.tsx", import.meta.url), "utf8");
  const fotos = [...comoFunciona.matchAll(/(?:como-funciona-)?\d\d-[\w-]+\.webp/g)].map((m) => m[0]);
  assert.ok(fotos.length >= 8);
  for (const f of fotos) assert.ok(!home.includes(f), `${f} aparece na home e em /como-funciona`);
  assert.doesNotMatch(home, /HOME_PASSOS_IMAGENS/);
});
