/*
  t389 (vermelho na main cc6f74f): confirmar a sugestão de uma foto ("Encontramos isto numa foto sua") marca a
  comodidade, mas é um clique — não dispara input/change, então não marcava editouRef. Se o clique caía nos 2 s
  depois de abrir o rascunho (E516: a janela em que o estado aberto vira a "base"), a comodidade confirmada entrava
  na base e nunca era gravada: o rascunho no banco ficava com amenityKeys vazio.
  Agora o onComodidade do cadastro marca a edição antes de mudar o estado.
  Roda: node --test src/lib/anuncio/t389-confirmar-sugestao-e-edicao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decisaoAutosave } from "./salvo-fantasma.ts";

const page = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");

test("t389: sem a marca de edição, a confirmação na janela da base vira base (não grava)", () => {
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: false, base: null, conteudo: "x" }), "base");
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: true, base: null, conteudo: "x" }), "edicao");
});

test("t389: o onComodidade do cadastro marca editouRef antes de marcar a comodidade", () => {
  const i = page.indexOf("onComodidade={");
  assert.ok(i > 0, "o cadastro passa onComodidade às sugestões das fotos");
  const corpo = page.slice(i, page.indexOf("onSugeridas=", i));
  assert.match(corpo, /editouRef\.current = true/);
  assert.ok(corpo.indexOf("editouRef.current = true") < corpo.indexOf("setAmenityKeys"), "a marca vem antes da mudança");
});
