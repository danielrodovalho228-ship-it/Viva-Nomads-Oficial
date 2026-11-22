/*
  E806 — /para-proprietarios, bloco "Publicamos para você": a frase "Você envia o link, o texto e as fotos do anúncio que
  já tem" (logo abaixo de "Pedidos da sua cidade", lida como "link da cidade") vira ação + efeito claros, pela fonte única.
  Roda: node --test src/lib/e806-publicamos-para-voce.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_APROVACAO, PUBLICAMOS_PARA_VOCE_TEXTO } from "./ajuda-publicacao/ajuda.ts";

const pagina = readFileSync(new URL("../app/(public)/para-proprietarios/page.tsx", import.meta.url), "utf8");
const formulario = readFileSync(new URL("../components/property/ajuda-publicar.tsx", import.meta.url), "utf8");

test("a frase antiga saiu da página", () => {
  assert.doesNotMatch(pagina, /Você envia o link/);
});

test("a frase diz QUAL link (o do anúncio em outro site), a ação e o efeito", () => {
  assert.match(PUBLICAMOS_PARA_VOCE_TEXTO, /^Já anuncia o imóvel em outro site\?/);
  assert.match(PUBLICAMOS_PARA_VOCE_TEXTO, /Cole o link desse anúncio, ou envie o texto e as fotos/);
  assert.match(PUBLICAMOS_PARA_VOCE_TEXTO, /a equipe da Viva monta o rascunho do anúncio aqui na plataforma/);
  assert.doesNotMatch(PUBLICAMOS_PARA_VOCE_TEXTO, /cidade/i);
  // O mesmo campo existe no formulário real do "Pedir ajuda para publicar".
  assert.match(formulario, /Link do seu anúncio/);
});

test("a página usa a frase única no bloco, seguida do aviso de aprovação, e o botão leva ao formulário", () => {
  assert.match(pagina, /data-testid="proprietarios-publicamos-texto">\s*\{PUBLICAMOS_PARA_VOCE_TEXTO\} \{AVISO_APROVACAO\}/);
  assert.match(AVISO_APROVACAO, /Nada vai ao ar sem a sua aprovação/);
  assert.match(pagina, /href="\/dashboard\/imoveis\/novo"[^>]*data-testid="proprietarios-pedir-ajuda"/);
});
