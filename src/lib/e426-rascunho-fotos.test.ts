/* Roda: node --test src/lib/e426-rascunho-fotos.test.ts — E426 (01/11): reprova das capas de rascunho após o #2108. O
   Início e Meus imóveis já não quebram, mas o ASSISTENTE reabria o rascunho com as URLs dos arquivos apagados (7
   rascunhos, 37 fotos em produção): miniaturas e prévia quebradas. Agora o rascunho chega sem elas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rascunhoSemFotosApagadas } from "./fotos-anuncio.ts";

const DONO = "11111111-2222-3333-4444-555555555555";
const url = (a: string) => `https://x.supabase.co/storage/v1/object/public/property-photos/${DONO}/${a}`;

test("tira só as fotos cujo arquivo saiu do bucket; o resto do rascunho fica igual", () => {
  const d = { title: "Studio", photos: [{ url: url("apagada.webp"), id: "1" }, { url: url("viva.webp"), id: "2" }, { url: "blob:demo" }] };
  const r = rascunhoSemFotosApagadas(d, new Set([`${DONO}/viva.webp`]));
  assert.deepEqual(r, { title: "Studio", photos: [{ url: url("viva.webp"), id: "2" }, { url: "blob:demo" }] });
  assert.equal(rascunhoSemFotosApagadas(d, null), d);
  assert.equal(rascunhoSemFotosApagadas(d, new Set([`${DONO}/apagada.webp`, `${DONO}/viva.webp`])), d);
  assert.equal(rascunhoSemFotosApagadas(null, new Set()), null);
});

// "carregar" (loadDraftData) era código morto e saiu: ficam as duas leituras em uso (abrir e último).
test("as leituras do rascunho (abrir, último) passam pelo filtro", () => {
  const a = readFileSync(new URL("./data/actions.ts", import.meta.url), "utf8");
  assert.match(a, /return \{ ok: true, draft: await semFotosApagadas\(row\.draft_data \?\? null, user\.id\) \};/);
  assert.doesNotMatch(a, /loadDraftData/);
  assert.match(a, /data: await semFotosApagadas\(\(row as \{ draft_data\?: unknown \} \| null\)\?\.draft_data \?\? null, user\.id\),/);
  assert.match(a, /rascunhoSemFotosApagadas\(draft, await arquivosDoDono\(createAdminClient\(\), ownerId\)\)/);
});
