/*
  Fotos do anúncio que entram em property_photos.
  Roda: node --test src/lib/fotos-anuncio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { fotosDoDono, urlsDoRascunho } from "./fotos-anuncio.ts";

const DONO = "7216d0e9-6246-482a-a1de-524fd5231dc2";
const base = "https://esezeutgtycekfosxplk.supabase.co/storage/v1/object/public/property-photos/";

test("só fotos da pasta do próprio dono, sem repetidas nem blob:", () => {
  const minha = `${base}${DONO}/a.jpg`;
  const r = fotosDoDono(
    [minha, minha, `${base}outro-dono/b.jpg`, "blob:https://x/1", "https://evil.example/c.jpg", 42, `${base}${DONO}/d.jpg`],
    DONO
  );
  assert.deepEqual(r, [minha, `${base}${DONO}/d.jpg`]);
});

test("rascunho com 8 fotos vira 8 URLs; limite de 24", () => {
  const data = { photos: Array.from({ length: 30 }, (_, i) => ({ id: String(i), url: `${base}${DONO}/${i}.jpg` })) };
  assert.equal(fotosDoDono(urlsDoRascunho(data), DONO).length, 24);
  assert.equal(fotosDoDono(urlsDoRascunho({ photos: data.photos.slice(0, 8) }), DONO).length, 8);
  assert.deepEqual(urlsDoRascunho(null), []);
  assert.deepEqual(urlsDoRascunho({ photos: "x" }), []);
});
