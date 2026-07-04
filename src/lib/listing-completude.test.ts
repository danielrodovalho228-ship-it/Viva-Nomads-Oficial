/*
  Testes da completude do anúncio (Dashboard Fase 3).
  Roda com: node --experimental-strip-types --test src/lib/listing-completude.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { completudeAnuncio, MIN_FOTOS_PUBLICAR } from "./listing-completude.ts";

test("anúncio vazio: 0% e não pode publicar", () => {
  const r = completudeAnuncio({});
  assert.equal(r.pct, 0);
  assert.equal(r.podePublicar, false);
  assert.ok(r.faltando.length > 0);
});

test("anúncio completo: 100%", () => {
  const r = completudeAnuncio({
    photos: ["/a.jpg", "/b.jpg", "/c.jpg", "/d.jpg", "/e.jpg"],
    description: "x".repeat(60),
    monthlyPrice: 3000,
    maxGuests: 4,
    areaM2: 68,
    availableFrom: "2026-08-01",
    garantiasAceitas: ["caucao_avista"],
    readyToLiveBadge: true,
    videoUrl: "https://youtu.be/x",
  });
  assert.equal(r.pct, 100);
  assert.equal(r.podePublicar, true);
  assert.equal(r.faltando.length, 0);
});

test("menos de 5 fotos: não pode publicar e fotos consta como faltando", () => {
  const r = completudeAnuncio({ photos: ["/a.jpg", "/b.jpg"], monthlyPrice: 3000 });
  assert.equal(r.podePublicar, false);
  assert.ok(r.faltando.some((f) => f.includes(String(MIN_FOTOS_PUBLICAR))));
});

test("ignora placeholders sem URL válida na contagem de fotos", () => {
  const r = completudeAnuncio({ photos: ["Sala", "Cozinha", "Quarto", "Banheiro", "Área"] });
  assert.equal(r.podePublicar, false); // rótulos, não URLs
});
