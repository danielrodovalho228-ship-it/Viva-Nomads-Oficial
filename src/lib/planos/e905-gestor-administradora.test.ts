/*
  E905: /para-proprietarios e /como-funciona diziam só "4% para carteiras de 20 ou mais imóveis" no Plano Gestor, sem a
  alternativa aprovada "ou conta de administradora" que a home ("ou para administradoras") e a Ajuda (PORTA_GESTOR_TEXTO)
  já trazem. O texto único das telas (GESTOR_TEXTO) passa a incluí-la — e com ele /para-proprietarios e /como-funciona
  (FRASE_ESCADA_TAXAS), /parceiros e /precos. Roda: node --test src/lib/planos/e905-gestor-administradora.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GESTOR_TEXTO, PORTA_GESTOR_TEXTO } from "../../config/planos.ts";
import { FRASE_ESCADA_TAXAS } from "../../config/textos-regulados.ts";

test("E905: o texto do Plano Gestor das telas traz 'ou conta de administradora'", () => {
  assert.equal(GESTOR_TEXTO, "4% para carteiras de 20 ou mais imóveis ou conta de administradora, com cadastro assistido da carteira e contato direto na Viva");
  // A mesma alternativa da Ajuda (PORTA_GESTOR_TEXTO).
  assert.match(PORTA_GESTOR_TEXTO, /ou conta de administradora$/);
});

test("E905: /para-proprietarios e /como-funciona mostram o Gestor pela frase única, que agora tem a administradora", () => {
  assert.match(FRASE_ESCADA_TAXAS, /Plano Gestor: 4% para carteiras de 20 ou mais imóveis ou conta de administradora,/);
  for (const p of ["para-proprietarios", "como-funciona"]) {
    const src = readFileSync(new URL(`../../app/(public)/${p}/page.tsx`, import.meta.url), "utf8");
    assert.match(src, /\{FRASE_ESCADA_TAXAS\}/, p);
  }
});
