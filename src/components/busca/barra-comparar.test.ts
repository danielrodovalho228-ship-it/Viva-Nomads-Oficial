import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/*
  E529 (D15; 3ª reprova de 06/11): a barra "Comparar (2)" era fixa e depois sticky no pé da coluna — nas duas versões flutuava
  sobre os cartões que passavam por baixo ao rolar. Agora é uma faixa NORMAL da página, logo acima da lista de resultados:
  sem sticky/fixed/sombra, ocupa o próprio espaço e nunca cobre cartão. O "Fale com a Viva" e o fim da página não precisam mais
  de elevação nem folga por causa dela.
*/
test("E529: a barra Comparar é uma faixa normal da página (sem sticky, fixed, sombra nem posição própria)", () => {
  const src = ler("components/busca/barra-comparar.tsx");
  const raiz = src.match(/<div className="([^"]+)" data-testid="barra-comparar">/)?.[1] ?? "";
  assert.match(raiz, /\bbg-white\b/);
  assert.match(raiz, /\bborder\b/);
  for (const proibido of [/\bsticky\b/, /\bfixed\b/, /\babsolute\b/, /\bshadow-/, /\binset-x-0\b/, /\bbottom-/, /vn-barra-comparar/]) assert.doesNotMatch(raiz, proibido);
  assert.doesNotMatch(src, /rounded-full/, "sem a pílula flutuante");
});

test("E529: a busca a põe ACIMA da lista de resultados, sem respiro de rodapé", () => {
  const busca = ler("app/(public)/buscar/search-client.tsx");
  const i = busca.indexOf("<BarraComparar");
  const j = busca.indexOf('data-testid="grade-resultados"');
  assert.ok(i > 0 && j > i, "a barra vem antes da grade de resultados");
  assert.doesNotMatch(busca, /comparar-respiro/);
});

test("E529: o CSS não tem mais regras de posição, folga ou elevação para a barra Comparar", () => {
  const css = ler("app/globals.css");
  assert.doesNotMatch(css, /vn-barra-comparar/);
  assert.doesNotMatch(css, /data-testid="barra-comparar"/);
});
