import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { capaDoDraftData } from "./fotos-anuncio.ts";

const DONO = "11111111-2222-3333-4444-555555555555";
const base = `https://abc.supabase.co/storage/v1/object/public/property-photos/${DONO}/`;

test("E308 — capa pelo draft_data: a 1ª foto do bucket do próprio dono; fora disso, null", () => {
  assert.equal(capaDoDraftData({ photos: [{ url: `${base}a.webp` }, { url: `${base}b.webp` }] }, DONO), `${base}a.webp`);
  // Foto de outra pasta, http, blob: ou lixo não viram capa (a mesma regra de property_photos).
  assert.equal(capaDoDraftData({ photos: [{ url: "blob:x" }, { url: "https://evil.example/a.jpg" }, { url: `${base}c.webp` }] }, DONO), `${base}c.webp`);
  assert.equal(capaDoDraftData({ photos: [] }, DONO), null);
  assert.equal(capaDoDraftData(null, DONO), null);
});

test("E308 — o Início usa property_photos e, sem linha ali, o draft_data", () => {
  const p = readFileSync(new URL("../app/(dashboard)/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(p, /async function capaDoRascunho\(id: string \| null, draftData: unknown\)/);
  assert.match(p, /if \(daTabela\) return daTabela;[\s\S]{0,160}capaDoDraftData\(draftData, user\.id\)/);
  assert.match(p, /capaDoRascunho\(draft\?\.id \?\? null, draft\?\.data \?\? null\)/);
});
