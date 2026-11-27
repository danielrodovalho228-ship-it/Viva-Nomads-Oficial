/*
  E705 (resíduo 2): excluir um rascunho apaga também as fotos que só existem no draft_data.
  Roda: node --test src/lib/minimizacao/e705-fotos-do-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { urlsDeFotosDoRascunho } from "./fotos-rascunho.ts";

test("lê as urls das fotos do draft_data, sem repetição e ignorando o que não é foto", () => {
  const u1 = "https://x.supabase.co/storage/v1/object/public/property-photos/dono/a.webp";
  const u2 = "https://x.supabase.co/storage/v1/object/public/property-photos/dono/b.webp";
  assert.deepEqual(urlsDeFotosDoRascunho({ photos: [{ url: u1 }, { url: u2 }, { url: u1 }, { url: "" }, null, { semUrl: 1 }, "x"] }), [u1, u2]);
  assert.deepEqual(urlsDeFotosDoRascunho(null), []);
  assert.deepEqual(urlsDeFotosDoRascunho({ photos: "não é lista" }), []);
  assert.deepEqual(urlsDeFotosDoRascunho({}), []);
});

test("deleteProperty junta as fotos do draft_data às de property_photos e usa a guarda do E308", () => {
  const a = readFileSync("src/lib/data/actions.ts", "utf8");
  const corpo = a.slice(a.indexOf("export async function deleteProperty"), a.indexOf("/** Operação guardada no estado do editor"));
  // E953 (asserção alterada): o draft_data NÃO é mais lido por SELECT de coluna com a sessão (fora do SELECT do C4 —
  // era a causa de "excluir não funciona"); vem pela RPC property_private_details em excluirRascunhoDoDono, que junta
  // as fotos do draft_data às de property_photos. A guarda do E308 segue no apagarFotosDoAnuncio.
  assert.doesNotMatch(corpo, /select\([^)]*draft_data/);
  assert.match(corpo, /excluirRascunhoDoDono\(supabase, user\.id, id\)/);
  assert.match(corpo, /apagarFotosDoAnuncio\(createAdminClient\(\), r\.urlsFotos\)/);
  const srv = readFileSync("src/lib/data/excluir-rascunho-servidor.ts", "utf8");
  assert.match(srv, /rpc\("property_private_details", \{ prop_id: id \}\)/);
  assert.match(srv, /urlsDeFotosDoRascunho\(linhaPrivada\?\.draft_data\)/);
  const m = readFileSync("src/lib/minimizacao/fotos-anuncio.ts", "utf8");
  assert.match(m, /contains\("draft_data", \{ photos: \[\{ url \}\] \}\)/, "a guarda do E308 segue conferindo o draft_data de outros anúncios");
});
