// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
/*
  E905: /para-proprietarios e /como-funciona diziam só "4% para carteiras de 20 ou mais imóveis" no Plano Gestor, sem a
  alternativa aprovada "ou conta de administradora" que a home ("ou para administradoras") e a Ajuda (PORTA_GESTOR_TEXTO)
  já trazem. O texto único das telas (GESTOR_TEXTO) passa a incluí-la — e com ele /para-proprietarios e /como-funciona
  (FRASE_ESCADA_TAXAS), /parceiros e /precos. Roda: node --test src/lib/planos/e905-gestor-administradora.test.ts
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o Plano Gestor de 4% saiu das telas. A alternativa "administradora" segue
  junto dos 20 imóveis, agora na linha única das carteiras (TEXTO_CARTEIRAS: "Carteira a partir de 20 imóveis ou administradora de
  imóveis: fale com a Viva."), sem taxa — é ela que /para-proprietarios e /como-funciona mostram pela frase única.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as planos from "../../config/planos.ts";
import { TEXTO_CARTEIRAS } from "../../config/planos.ts";
import { FRASE_ESCADA_TAXAS } from "../../config/textos-regulados.ts";

test("E905/078: a linha das carteiras das telas traz 'ou administradora de imóveis' (o texto do Plano Gestor saiu)", () => {
  // 078 (Daniel, 16/11/2026): antes GESTOR_TEXTO === "4% para carteiras de 20 ou mais imóveis ou conta de administradora, com cadastro
  // assistido da carteira e contato direto na Viva". O texto único agora é a linha das carteiras: mesma alternativa, sem taxa.
  assert.equal("GESTOR_TEXTO" in planos, false);
  assert.equal(TEXTO_CARTEIRAS, "Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.");
  // 078 (Daniel, 16/11/2026): antes a Ajuda trazia a alternativa por PORTA_GESTOR_TEXTO (/ou conta de administradora$/); a Ajuda usa a
  // mesma linha das carteiras, e a alternativa está nela.
  assert.equal("PORTA_GESTOR_TEXTO" in planos, false);
  assert.match(TEXTO_CARTEIRAS, /20 imóveis ou administradora de imóveis: fale com a Viva\.$/);
  assert.match(readFileSync(new URL("../atendimento/faq.ts", import.meta.url), "utf8"), /\$\{escadaTaxasCurta\(\)\}\. \$\{TEXTO_CARTEIRAS\}/);
});

test("E905/078: /para-proprietarios e /como-funciona mostram as carteiras pela frase única, que tem a administradora e não tem o Gestor", () => {
  // 078 (Daniel, 16/11/2026): antes /Plano Gestor: 4% para carteiras de 20 ou mais imóveis ou conta de administradora,/.
  assert.match(FRASE_ESCADA_TAXAS, /16–19 imóveis: 6%\. Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva\.$/);
  assert.doesNotMatch(FRASE_ESCADA_TAXAS, /Plano Gestor|(?<![\d,.])4\s?%/);
  for (const p of ["para-proprietarios", "como-funciona"]) {
    const src = readFileSync(new URL(`../../app/(public)/${p}/page.tsx`, import.meta.url), "utf8");
    assert.match(src, /\{FRASE_ESCADA_TAXAS\}/, p);
  }
});
