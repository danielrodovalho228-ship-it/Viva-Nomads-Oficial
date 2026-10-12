/*
  Pacote Otávio 11/10 noite (#61): sitemap, títulos <= 60, descrições <= 160 e H2 no guia.
  Roda: node --test src/lib/sitemap-titulos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("#61: sitemap lista /guia-fotos e /parceiros/fotografos", () => {
  const s = ler("app/sitemap.ts");
  assert.match(s, /"\/guia-fotos"/);
  assert.match(s, /"\/parceiros\/fotografos"/);
});

test("#61: title <= 60 e description <= 160 nas páginas do pacote", () => {
  // app/layout.tsx fica de fora do limite de 60 do title: o texto de prazo/temporada
  // da home não muda até o parecer da Dra. Beatriz (ordem 4ef9abd9). Reincluir depois.
  for (const p of [
    "app/(public)/precos/page.tsx",
    "app/(public)/para-proprietarios/page.tsx",
    "app/(public)/guia-fotos/page.tsx",
    "app/(public)/parceiros/fotografos/page.tsx",
  ]) {
    const src = ler(p);
    const bloco = src.match(/export const metadata[^=]*=\s*\{([\s\S]*?)\n\};/)![1];
    const t = bloco.match(/title:\s*(?:\{\s*default:\s*)?"([^"]+)"/)!;
    assert.ok(t[1].length <= 60, `${p}: title com ${t[1].length}`);
    const d = bloco.match(/description:\s*(?:"([^"]+)"|TEXTO_REGRA_CURTO \+ "([^"]+)")/);
    if (d && d[1]) assert.ok(d[1].length <= 160, `${p}: description com ${d[1].length}`);
  }
});

test("#61: mantém '30 a 180 dias' no título da home (prazo intocado)", () => {
  assert.match(ler("app/layout.tsx"), /Imóveis mobiliados para estadias de 30 a 180 dias/);
});

test("#61: guia de fotos tem H2 entre o H1 e os H3", () => {
  const s = ler("app/(public)/guia-fotos/page.tsx");
  assert.ok(s.indexOf("<h1") < s.indexOf("<h2") && s.indexOf("<h2") < s.indexOf("<GuiaFotos"));
});
