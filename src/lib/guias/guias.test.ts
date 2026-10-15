import test from "node:test";
import assert from "node:assert/strict";
import { GUIAS, artigoGuia, guiaPorSlug, textoDoGuia } from "./guias.ts";

const SUFIXO = " · Viva Nomads";

test("#1438f18d: 6 guias iniciais, slugs únicos", () => {
  assert.equal(GUIAS.length, 6);
  assert.equal(new Set(GUIAS.map((g) => g.slug)).size, 6);
  assert.ok(guiaPorSlug("o-que-e-a-caucao"));
  assert.equal(guiaPorSlug("nao-existe"), undefined);
});

test("#1438f18d: título com a marca <= 60 e descrição preenchida", () => {
  for (const g of GUIAS) {
    assert.ok((g.titulo + SUFIXO).length <= 60, `${g.slug}: ${(g.titulo + SUFIXO).length}`);
    assert.ok(g.descricao.length > 40 && g.secoes.length >= 3);
  }
});

test("#1438f18d: regras de texto (sem temporada, vistoria, aluguel, comissão, corretagem…)", () => {
  for (const g of GUIAS) {
    const t = textoDoGuia(g);
    assert.doesNotMatch(t, /temporada|vistoria|comiss|corretag|intermedia|art\.? ?48/i, g.slug);
    // “aluguéis” só vem da frase única da Caução; “aluguel” solto não.
    assert.doesNotMatch(t.replace(/Caução devolvível de até 3 aluguéis/, ""), /alugu?[eé]|alugar/i, g.slug);
    assert.doesNotMatch(t, /garantia/i, g.slug);
    assert.doesNotMatch(t, /\bR\$ ?\d/, `${g.slug}: sem número de mercado`);
  }
});

test("#1438f18d: JSON-LD Article sem coordenada nem avaliação", () => {
  const a = artigoGuia("https://vivanomads.com.br", GUIAS[0]);
  assert.equal(a["@type"], "Article");
  assert.equal(a.url, "https://vivanomads.com.br/guias/como-precificar-estadia-de-meses");
  assert.doesNotMatch(JSON.stringify(a), /latitude|longitude|geo|aggregateRating/i);
});

test("#1438f18d: o guia da Caução usa a frase única do site e o da conferência traz as 48 horas", () => {
  assert.match(textoDoGuia(guiaPorSlug("o-que-e-a-caucao")!), /a plataforma não tem acesso ao dinheiro/);
  assert.match(textoDoGuia(guiaPorSlug("como-funciona-a-conferencia-de-entrada")!), /48 horas/);
});

test("#1438f18d: guias no sitemap, no rodapé, na Central de Ajuda e no llms.txt", async () => {
  const { readFileSync } = await import("node:fs");
  const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  assert.match(ler("src/app/sitemap.ts"), /"\/guias"/);
  assert.match(ler("src/app/sitemap.ts"), /GUIAS\.map/);
  assert.match(ler("src/components/layout/footer.tsx"), /href="\/guias"/);
  assert.match(ler("src/app/(public)/ajuda/page.tsx"), /href="\/guias"/);
  assert.match(ler("src/lib/seo/llms.ts"), /"\/guias"/);
  const guia = ler("src/app/(public)/guias/[slug]/page.tsx");
  assert.match(guia, /href="\/buscar"/);
  assert.match(guia, /href="\/para-proprietarios"/);
});
