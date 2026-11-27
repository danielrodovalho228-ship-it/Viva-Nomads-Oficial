/**
 * Onda 5 (matriz admin-anuncios): na lista do admin, cada anúncio mostra a foto de capa (como no mockup) — a 1ª foto real
 * do anúncio; sem foto válida, o espaço "sem foto" (nunca uma foto do acervo). `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { capasPorImovel, emLotes } from "./capas-admin.ts";

const U = (n: string) => `https://x.supabase.co/storage/v1/object/public/property-photos/a/${n}.webp`;

test("a capa é a foto de menor ordem que é URL de imagem; anúncio sem foto válida fica de fora", () => {
  const capas = capasPorImovel([
    { property_id: "a", url: U("a2"), sort_order: 2 },
    { property_id: "a", url: U("a0"), sort_order: 0 },
    { property_id: "b", url: "Foto QA Premium 1 - Sala", sort_order: 0 },
    { property_id: "c", url: U("c1"), sort_order: 1 },
  ]);
  assert.equal(capas.get("a"), U("a0"));
  assert.equal(capas.has("b"), false, "nome de foto de teste não vira capa");
  assert.equal(capas.get("c"), U("c1"));
});

test("os ids vão em lotes (a lista do admin tem até 3000 anúncios)", () => {
  const ids = Array.from({ length: 1201 }, (_, i) => `id${i}`);
  const l = emLotes(ids, 500);
  assert.deepEqual(l.map((x) => x.length), [500, 500, 201]);
  assert.deepEqual(l.flat(), ids);
});

test("a lista do admin desenha a capa ou o espaço sem foto, e lê só a capa (ordem 0) em lotes", () => {
  const pagina = readFileSync(new URL("../../app/(dashboard)/admin/imoveis/page.tsx", import.meta.url), "utf8");
  assert.match(pagina, /data-testid="imovel-capa"/);
  assert.match(pagina, /<PhotoPlaceholder/);
  const dados = readFileSync(new URL("../data/admin-indicadores.ts", import.meta.url), "utf8");
  assert.match(dados, /from\("property_photos"\)[\s\S]{0,200}\.eq\("sort_order", 0\)/);
  assert.match(dados, /emLotes\(ids, 500\)/);
});
