/*
  Varredura 02/11 (Pista A), achados a 390 px:
  1. 404: o logo (32 px) e "É proprietário? Anuncie seu imóvel →" (20 px) sem área de toque de 44 px.
  2. 404 no tablet (2 colunas): os 3 imóveis em destaque deixavam um buraco — em 2 colunas aparecem 2.
  3. Perfil do proprietário (real e de exemplo): o link "4,7 · 11 avaliações" com 20 px.
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("404: logo e link de anunciar com alvo de 44 px; destaques em grade par no tablet", () => {
  const src = ler("./not-found.tsx");
  // E916 (asserção alterada): a 404 deixou o logo próprio e usa o cabeçalho padrão (Navbar), o mesmo de todas as páginas
  // públicas — o alvo do logo passa a ser o do Navbar. Os demais alvos da 404 seguem travados abaixo.
  assert.match(src, /<Navbar \/>/);
  assert.doesNotMatch(src, /<Logo /);
  assert.match(src, /className="alvo-toque mt-12 text-sm text-muted hover:text-blue-500"\n\s*data-testid="nao-encontrada-anunciar"/);
  // E961: a vitrine dos destaques saiu do not-found.tsx para um componente de cliente; a grade par é cobrada lá.
  assert.match(ler("../components/nao-encontrada/destaques-da-404.tsx"), /sm:grid-cols-2 sm:max-lg:\[&>:nth-child\(3\)\]:hidden lg:grid-cols-3/);
});

test("perfil do proprietário (real e exemplo): link das avaliações com alvo de 44 px", () => {
  for (const f of ["./(public)/proprietario/[id]/page.tsx", "./(public)/proprietario/[id]/perfil-exemplo.tsx"]) {
    assert.match(ler(f), /<a href="#avaliacoes" className="alvo-toque inline-flex items-center gap-1[^"]*" data-testid="perfil-link-avaliacoes">/, f);
  }
});

/*
  E1038 (helper da área de toque REAL da Pista 3, #4031; lab 44650708319): a 390 px a caixa 44×44 do "anunciar" caía em
  cima do link da ajuda — um toque na parte de baixo abria a ajuda. Cada link tem 20 px de texto (text-sm) e uma área de
  44 px centrada (alvo-toque): sobra 12 px acima e abaixo. Para as duas áreas não se tocarem, o espaço entre os dois links
  tem de passar de 2 × 12 = 24 px. Vermelho na main: mt-2 = 8 px.
*/
test("E1038: as áreas de toque do 'anunciar' e da ajuda não se sobrepõem (espaço entre os links > 24 px)", () => {
  const src = ler("./not-found.tsx");
  const ajuda = src.match(/<Link href="\/ajuda" className="([^"]*)" data-testid="nao-encontrada-ajuda">/);
  assert.ok(ajuda, "o link da ajuda da 404");
  const classes = ajuda[1].split(/\s+/);
  assert.ok(classes.includes("alvo-toque") && classes.includes("text-sm"), "o link da ajuda segue com alvo de 44 px e texto de 20 px");
  const mt = classes.map((c) => /^mt-(\d+)$/.exec(c)).find(Boolean);
  assert.ok(mt, "o link da ajuda tem margem de topo");
  const espaco = Number(mt[1]) * 4; // escala do Tailwind: 1 = 4 px
  const sobra = (44 - 20) / 2; // o que a área de toque passa do texto, acima e abaixo
  assert.ok(espaco > 2 * sobra, `espaço entre os links ${espaco} px; precisa passar de ${2 * sobra} px`);
});
