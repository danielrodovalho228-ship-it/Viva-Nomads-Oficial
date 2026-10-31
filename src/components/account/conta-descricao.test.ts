/* Varredura 31/10: no menu da Conta (celular), a descrição de cada item vai em até 2 linhas — antes cortava a 390
   ("O que disseram de você depois de cada …"). Roda: node --test src/components/account/conta-descricao.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("descrição do item da Conta: line-clamp-2, sem truncate", () => {
  const c = readFileSync(new URL("./conta-menu.tsx", import.meta.url), "utf8");
  assert.match(c, /<span className="line-clamp-2 text-xs text-muted" data-testid="conta-item-descricao">\{it\.descricao\}<\/span>/);
  assert.doesNotMatch(c, /block truncate text-xs text-muted">\{it\.descricao\}/);
});
