/* Roda: node --test src/components/layout/rodape-folga-abas.test.ts — a última linha do rodapé acima da barra de abas
   também onde o "Fale com a Viva" não aparece (/buscar; t265 a 390 px). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS = readFileSync("src/app/globals.css", "utf8");

test("sem o 'Fale com a Viva', o rodapé ganha a folga da barra de abas no celular", () => {
  assert.match(
    CSS,
    /@media \(max-width: 767px\) \{\s*html:not\(\[data-app\]\) body:has\(nav\[aria-label="Navegação principal"\]\):not\(:has\(\[data-testid="fale-com-a-viva-raiz"\]\)\) \.vn-rodape \{\s*padding-bottom: calc\(var\(--altura-abas\) \+ 1rem \+ env\(safe-area-inset-bottom, 0px\)\);/
  );
  // A barra é a "Navegação principal" do celular (mobile-tab-bar.tsx).
  assert.match(readFileSync("src/components/layout/mobile-tab-bar.tsx", "utf8"), /"Navegação principal"/);
});
