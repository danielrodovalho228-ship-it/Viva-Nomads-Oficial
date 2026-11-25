import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* E916: a página 404 não tinha busca nem rodapé. Passa a ter o rodapé padrão do site e um campo de busca (vai à
   /buscar), além do caminho para a Central de Ajuda. */
const s = readFileSync("src/app/not-found.tsx", "utf8");

test("a 404 tem o rodapé padrão do site", () => {
  assert.match(s, /import \{ Footer \} from "@\/components\/layout\/footer"/);
  assert.match(s, /<Footer \/>/);
});

test("a 404 tem um campo de busca que leva à /buscar e o caminho para a Ajuda", () => {
  assert.match(s, /<form[^>]*action="\/buscar"[^>]*data-testid="nao-encontrada-busca"/);
  assert.match(s, /name="local"/);
  assert.match(s, /href="\/ajuda"/);
});
