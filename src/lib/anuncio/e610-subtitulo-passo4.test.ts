/* Roda: node --test src/lib/anuncio/e610-subtitulo-passo4.test.ts
  E610: o subtítulo do Passo 4 dizia "Informe os detalhes do seu imóvel para finalizar o cadastro." — no passo 4 de 10,
  isso engana (faltam seis passos). Agora diz o que o passo pede, e nenhum passo antes da Revisão fala em finalizar/concluir.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { TELAS_ASSISTENTE } from "./assistente-telas.ts";

test("E610: o Passo 4 diz o que pede (quartos, banheiros, área, pessoas e vagas), sem 'finalizar o cadastro'", () => {
  const p4 = TELAS_ASSISTENTE[3];
  assert.equal(p4.rotulo, "Detalhes");
  assert.equal(p4.subtitulo, "Conte como é o imóvel: quartos, banheiros, área, quantas pessoas podem morar e vagas de garagem.");
});

test("E610: nenhum passo antes da Revisão fala em finalizar, concluir ou terminar o cadastro", () => {
  for (const t of TELAS_ASSISTENTE.slice(0, -1)) assert.doesNotMatch(`${t.titulo} ${t.subtitulo}`, /finaliz|conclu|termin/i, t.rotulo);
});
