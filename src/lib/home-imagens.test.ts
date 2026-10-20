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
  // t112 (ordem 0f204e06): os 4 passos, todos prontos e existentes, com fotos distintas entre si.
  assert.equal(new Set(HOME_PASSOS_IMAGENS.map((i) => i.src)).size, 4);
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

test("t112: nenhuma foto dos passos da home aparece em outra página pública", () => {
  const paginas = ["como-funciona", "para-proprietarios", "parceiros", "empresas", "precos"].map((p) =>
    readFileSync(new URL(`../app/(public)/${p}/page.tsx`, import.meta.url), "utf8")
  );
  const extras = ["../lib/parceiros-cartoes.ts", "../config/atalhos-home.ts", "../lib/media.ts"].map((f) => {
    // media.ts: só conta o que as páginas públicas realmente usam; aqui basta o nome do arquivo literal.
    return readFileSync(new URL(f, import.meta.url), "utf8");
  });
  for (const i of HOME_PASSOS_IMAGENS) {
    const nome = i.src.split("/").pop()!;
    for (const fonte of [...paginas, ...extras.slice(0, 2)])
      assert.ok(!fonte.includes(nome), `${nome} repetida fora da home`);
  }
});
