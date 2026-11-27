/* Roda: node --test src/components/anuncio/e193-passo6-um-padrao.test.ts
  E193 (reteste de 29/10, mistura persiste): no Passo 6 (regras, pets) e em Editar anúncio, toda escolha é o cartão grande da
  Qualificação: nada de rádio ou caixa dentro de pílula arredondada, nem lista suspensa. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const ARQUIVOS = [
  "src/components/anuncio/regras-casa-campos.tsx",
  "src/components/anuncio/pets-regras-campos.tsx",
  "src/components/anuncio/limpeza-estadia-campos.tsx",
  "src/components/anuncio/detalhes-anuncio-campos.tsx",
];

test("E193: nenhum rádio, caixa, lista suspensa nem pílula arredondada nos campos do Passo 6 e de Editar", () => {
  for (const a of ARQUIVOS) {
    const src = ler(a);
    assert.doesNotMatch(src, /type="(radio|checkbox)"/, `${a}: rádio/caixa nativos`);
    assert.doesNotMatch(src, /<select\b/, `${a}: lista suspensa`);
    assert.doesNotMatch(src, /rounded-full/, `${a}: pílula arredondada`);
    assert.doesNotMatch(src, /<Pilula\b/, `${a}: Pilula`);
  }
});

test("E193: festas, visitas, fumo e pernoite são EscolhaUnica (cartões radio)", () => {
  const src = ler("src/components/anuncio/regras-casa-campos.tsx");
  assert.match(src, /<EscolhaUnica<"" \| T> testid=\{`regras-casa-\$\{nome\}`\}/);
});

test("E193: pets — espécies em cartões de marcar; porte, quantidade e tipo do valor em cartões de escolha única", () => {
  const src = ler("src/components/anuncio/pets-regras-campos.tsx");
  assert.match(src, /<CartaoEscolha key=\{e\} papel="checkbox"/);
  for (const id of ["pets-porte", "pets-qtd", "valor-pet-tipo"]) assert.match(src, new RegExp(`testid="${id}"`), id);
});

test("E193: EscolhaUnica expõe radiogroup e cartões role=radio com aria-checked", () => {
  const src = ler("src/components/anuncio/escolha-assistente.tsx");
  assert.match(src, /role="radiogroup"/);
  assert.match(src, /export function EscolhaUnica/);
  assert.match(src, /papel = "radio"/);
});
