import test from "node:test";
import assert from "node:assert/strict";
import { GUIAS, artigoGuia, guiaPorSlug, textoDoGuia } from "./guias.ts";

const SUFIXO = " · Viva Nomads";

test("#1438f18d + 65-B: 7 guias (o do vídeo no anúncio), slugs únicos", () => {
  assert.equal(GUIAS.length, 7);
  assert.equal(new Set(GUIAS.map((g) => g.slug)).size, 7);
  assert.ok(guiaPorSlug("como-por-um-video-no-anuncio"));
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
    assert.doesNotMatch(t, /alugu?[eé]|alugar/i, g.slug);
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
  assert.match(textoDoGuia(guiaPorSlug("o-que-e-a-caucao")!), /a Viva não recebe nem segura esse dinheiro/);
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

test("E773: nenhum guia manda para /precos enquanto a página está suspensa (E563)", async () => {
  const { PRECOS_VISIVEL } = await import("../../config/precos-visivel.ts");
  if (PRECOS_VISIVEL) return;
  const { readFileSync } = await import("node:fs");
  const fonte = readFileSync(new URL("./guias.ts", import.meta.url), "utf8");
  const texto = JSON.stringify(await import("./guias.ts"));
  assert.doesNotMatch(texto, /\/precos/);
  assert.match(fonte, /PRECOS_VISIVEL \? " A tabela completa está em \/precos\." : ""/);
});

test("E773 (RELATORIO-007): o guia de precificação cita as faixas aprovadas 12/10/8/6 e o Gestor 4%, lidas da regra de cobrança", async () => {
  const { GUIAS, FAIXAS_DO_GUIA } = await import("./guias.ts");
  const { FAIXAS_COMISSAO_PADRAO } = await import("../cobranca/regra.ts");
  assert.equal(
    FAIXAS_DO_GUIA,
    "Faixas por imóveis ativos (publicados, com documento aprovado e calendário em dia): 1–2 imóveis ativos: 12%; 3–5: 10%; 6–15: 8%; 16–19: 6%. " +
      "O Plano Gestor tem taxa de 4%, sem mensalidade, para 20 imóveis ou mais ativos (publicados, com documento aprovado e calendário em dia), ou conta de administradora.",
  );
  // Cada faixa da regra aparece no texto (se a regra mudar, o guia acompanha).
  for (const f of FAIXAS_COMISSAO_PADRAO) assert.match(FAIXAS_DO_GUIA, new RegExp(`${Math.round(f.taxa * 100)}%`));
  const guia = GUIAS.find((g) => g.slug === "como-precificar-estadia-de-meses");
  assert.ok(guia, "guia de precificação existe");
  const paragrafos = guia!.secoes.flatMap((s) => s.paragrafos);
  assert.ok(paragrafos.includes(FAIXAS_DO_GUIA), "o guia mostra as faixas na seção da taxa");
});
