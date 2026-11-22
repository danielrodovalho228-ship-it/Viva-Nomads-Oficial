import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* E916: a página 404 não tinha busca nem rodapé. Passa a ter o rodapé padrão do site e um campo de busca (vai à
   /buscar), além do caminho para a Central de Ajuda. */
const s = readFileSync("src/app/not-found.tsx", "utf8");
// E1019: o formulário da busca mudou-se para um componente (repõe o texto se o campo for trocado); a 404 o usa.
const busca = readFileSync("src/components/layout/busca-nao-encontrada.tsx", "utf8");

test("a 404 tem o rodapé padrão do site", () => {
  assert.match(s, /import \{ Footer \} from "@\/components\/layout\/footer"/);
  assert.match(s, /<Footer \/>/);
});

test("a 404 tem um campo de busca que leva à /buscar e o caminho para a Ajuda", () => {
  assert.match(s, /<BuscaNaoEncontrada \/>/);
  assert.match(busca, /<form[^>]*action="\/buscar"[^>]*data-testid="nao-encontrada-busca"/);
  assert.match(busca, /name="local"/);
  assert.match(s, /href="\/ajuda"/);
});

/* E916 (re-prova, ORDEM-DUET-019): o cabeçalho tinha só o logo. A 404 passa a usar o cabeçalho padrão do site (o
   mesmo Navbar das páginas públicas: Imóveis · Anunciar · Empresas · Parceiros · Entrar) e, no celular, a mesma barra
   de abas. Trava a casca completa: cabeçalho com navegação + busca + rodapé. */
test("E916: a 404 tem o cabeçalho padrão com a navegação do site (não só o logo)", () => {
  assert.match(s, /import \{ Navbar \} from "@\/components\/layout\/navbar"/);
  assert.match(s, /<Navbar \/>/);
  assert.doesNotMatch(s, /<header[^>]*>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<Logo/, "cabeçalho só com o logo voltou");
  assert.match(s, /import \{ MobileTabBar \} from "@\/components\/layout\/mobile-tab-bar"/);
});

test("E916: a casca completa está na ordem — cabeçalho, busca, rodapé", () => {
  const nav = s.indexOf("<Navbar />");
  const busca = s.indexOf("<BuscaNaoEncontrada />");
  const rodape = s.indexOf("<Footer />");
  assert.ok(nav > 0 && busca > nav && rodape > busca, "ordem cabeçalho → busca → rodapé");
});
