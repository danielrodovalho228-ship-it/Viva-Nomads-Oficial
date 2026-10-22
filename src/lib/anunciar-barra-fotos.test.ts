/* Roda: node --test src/lib/anunciar-barra-fotos.test.ts — Anunciar imóvel (celular): a barra "Fotos: N de 8 mínimas"
   não cobre nenhum controle (QA do Daniel, 22/10). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isFlowRoute } from "./nav-mobile.ts";

const css = readFileSync(join("src", "app/globals.css"), "utf8");
const barra = readFileSync(join("src", "app/(dashboard)/dashboard/imoveis/novo/barra-fotos.tsx"), "utf8");

test("Anunciar é tela de fluxo (sem abas): a barra encosta no fim da tela, não 3,5 rem acima", () => {
  assert.equal(isFlowRoute("/dashboard/imoveis/novo"), true);
  assert.doesNotMatch(barra, /vn-barra-fixa/);
  assert.match(barra, /vn-barra-fotos fixed inset-x-0/);
  assert.match(css, /\.vn-barra-fotos\s*\{\s*bottom: 0;\s*padding-bottom: calc\(0\.5rem \+ env\(safe-area-inset-bottom, 0px\)\);/);
});

test("a barra mede a própria altura; respiro, rolagem até o campo e o 'Fale com a Viva' usam essa medida", () => {
  assert.match(barra, /new ResizeObserver\(medir\)/);
  assert.match(barra, /setProperty\("--altura-barra-fotos"/);
  assert.match(barra, /removeProperty\("--altura-barra-fotos"\)/);
  assert.match(barra, /className="vn-respiro-barra-fotos md:hidden"/);
  assert.doesNotMatch(barra, /className="h-16 md:hidden"/);
  assert.match(css, /\.vn-respiro-barra-fotos\s*\{\s*height: calc\(var\(--altura-barra-fotos, 4rem\) \+ 5rem\);/);
  assert.match(css, /body:has\(\[data-testid="barra-fotos"\]\)\s*\{\s*--ajuda-bottom: calc\(var\(--altura-barra-fotos, 4rem\) \+ 0\.75rem\);\s*--viva-piso:/);
  // :root (0,2,0) vence html:has(fale-com-a-viva-raiz) (0,1,1), que vem depois no arquivo.
  assert.match(css, /:root:has\(\[data-testid="barra-fotos"\]\)\s*\{\s*scroll-padding-bottom: calc\(var\(--altura-barra-fotos, 4rem\) \+ 5rem\);/);
});
