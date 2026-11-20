// C19 (QA 08/11): /auth estourava a largura abaixo de 378 px (58 px a 320, 18 px a 360, 3 px a 375). A trilha implícita do
// grid crescia até a largura mínima do formulário. Correção: coluna única abaixo de lg e min-w-0 na coluna do formulário.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/app/auth/page.tsx", "utf8");

test("C19: o grid da /auth tem coluna única abaixo de lg e a coluna do formulário aceita encolher", () => {
  assert.match(s, /<div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">/);
  assert.match(s, /className=\{`flex min-w-0 items-center justify-center px-4 py-8 sm:p-12 \$\{FUNDO_FORMULARIO_PORTA\}`\} data-testid="porta-formulario"/);
});
