import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("7ffea8c7: a barra Comparar fica acima das abas do celular (não usa bottom-3 fixo)", () => {
  const src = ler("components/busca/barra-comparar.tsx");
  assert.match(src, /vn-barra-comparar/);
  assert.doesNotMatch(src, /bottom-3/);
  const css = ler("app/globals.css");
  assert.match(css, /--altura-abas:\s*3\.5rem/);
  assert.match(css, /\.vn-barra-comparar\s*\{\s*bottom: calc\(var\(--altura-abas\) \+ env\(safe-area-inset-bottom, 0px\) \+ 0\.75rem\)/);
  // computador: 12 px do rodapé (sem regressão)
  assert.match(css, /min-width: 768px\)\s*\{\s*\.vn-barra-comparar\s*\{\s*bottom: 0\.75rem/);
});

test("7ffea8c7: com a barra visível o 'Fale com a Viva' sobe e o fim da página ganha folga (só celular)", () => {
  const css = ler("app/globals.css");
  assert.match(css, /max-width: 767px\)\s*\{\s*body:has\(\[data-testid="barra-comparar"\]\)\s*\{\s*--ajuda-bottom: 10rem/);
  assert.match(css, /padding-bottom: calc\(var\(--altura-abas\) \+ 6rem/);
});

test("af3a27e3: 'Fale com a Viva' arrastado também respeita o piso da barra Comparar (celular)", () => {
  const css = ler("app/globals.css");
  assert.match(css, /body:has\(\[data-testid="barra-comparar"\]\)\s*\{\s*--ajuda-bottom: 10rem;\s*--viva-piso: 10rem;/);
  const src = ler("components/ajuda/viva-chat.tsx");
  assert.match(src, /bottom: `max\(\$\{pos\.baixo\}px, var\(--viva-piso, 0px\)\)`/);
});

/*
  E529 (D15, QA de cliques do morador 02/11): a barra "Comparar (2)" flutuava (pílula fixa no meio da tela) sobre os
  cartões. Agora é uma barra ENCAIXADA na coluna de resultados: sticky (não fixed), largura toda da coluna, fundo branco
  opaco com borda — no fim da lista ela fica DEPOIS do último cartão; e a página ganha scroll-padding embaixo enquanto
  ela existe (o que rola até a vista para acima dela, nunca por baixo).
*/
test("E529: barra Comparar encaixada na coluna (sticky, largura toda, fundo opaco), não mais uma pílula fixa", () => {
  const src = ler("components/busca/barra-comparar.tsx");
  const raiz = src.match(/<div className="([^"]+)" data-testid="barra-comparar">/)?.[1] ?? "";
  assert.match(raiz, /\bvn-barra-comparar\b/);
  assert.match(raiz, /\bsticky\b/);
  assert.doesNotMatch(raiz, /\bfixed\b/);
  assert.doesNotMatch(raiz, /\binset-x-0\b/);
  assert.match(raiz, /\bbg-white\b/);
  assert.match(raiz, /\bborder-t\b/);
  assert.doesNotMatch(src, /rounded-full/, "sem a pílula flutuante");
});

test("E529: enquanto a barra existe, o que rola até a vista para acima dela (scroll-padding embaixo)", () => {
  const css = ler("app/globals.css");
  assert.match(css, /html:has\(\[data-testid="barra-comparar"\]\)\s*\{\s*scroll-padding-bottom: 8rem;/);
});
