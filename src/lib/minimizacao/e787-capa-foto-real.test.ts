/* Roda: node --test src/lib/minimizacao/e787-capa-foto-real.test.ts — E787: a capa do "Continue seu anúncio" ignora arquivo que não é foto. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAMANHO_MINIMO_FOTO_REAL_BYTES, caminhosDaListagem, capaDoDraftData, pareceFotoReal } from "../fotos-anuncio.ts";

const DONO = "671f2146-25af-4f8c-80b7-b5976a9590fd";

test("1784 bytes (foto de massa de teste, cor única) não é foto; 12 KB é", () => {
  assert.equal(pareceFotoReal(1784), false);
  assert.equal(pareceFotoReal(12_000), true);
  assert.equal(pareceFotoReal(TAMANHO_MINIMO_FOTO_REAL_BYTES), true);
  assert.equal(pareceFotoReal(undefined), true); // sem tamanho informado: não descarta
});
test("com soFotosReais, o arquivo pequeno sai da lista; sem a opção, tudo continua (o editor não muda)", () => {
  const lista = [{ name: "chapa.webp", metadata: { size: 1784 } }, { name: "foto.webp", metadata: { size: 52_000 } }];
  assert.deepEqual(caminhosDaListagem(lista, DONO, true), [`${DONO}/foto.webp`]);
  assert.deepEqual(caminhosDaListagem(lista, DONO, false), [`${DONO}/chapa.webp`, `${DONO}/foto.webp`]);
});
test("a capa pula a chapa e cai na foto de verdade; só chapas → sem capa (espaço desenhado)", () => {
  const base = `https://x.supabase.co/storage/v1/object/public/property-photos/${DONO}`;
  const draft = { photos: [`${base}/chapa.webp`, `${base}/foto.webp`] };
  const reais = new Set(caminhosDaListagem([{ name: "chapa.webp", metadata: { size: 1784 } }, { name: "foto.webp", metadata: { size: 52_000 } }], DONO, true));
  assert.equal(capaDoDraftData(draft, DONO, reais), `${base}/foto.webp`);
  const soChapas = new Set(caminhosDaListagem([{ name: "chapa.webp", metadata: { size: 1784 } }], DONO, true));
  assert.equal(capaDoDraftData({ photos: [`${base}/chapa.webp`] }, DONO, soChapas), null);
});
test("o painel pede a capa só com fotos reais", () => {
  assert.match(readFileSync("src/app/(dashboard)/dashboard/inicio-dados.tsx", "utf8"), /arquivosDoDono\(createAdminClient\(\), user\.id, \{ soFotosReais: true \}\)/);
});
test("o servidor usa a mesma regra pura na listagem do bucket", () => {
  assert.match(readFileSync("src/lib/minimizacao/fotos-anuncio.ts", "utf8"), /caminhosDaListagem\(\(data \?\? \[\]\) as ArquivoListado\[\], ownerId, opcoes\.soFotosReais === true\)/);
});
