/* E75 — padrão de fechamento da Conta. Roda: node --test src/lib/conta/fechamento.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LINHA_FECHAMENTO_CONTA } from "./secoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("toda tela da Conta (casca) e o menu terminam na linha institucional, sem vão no computador", () => {
  assert.equal(LINHA_FECHAMENTO_CONTA, "Viva Nomads · Uberlândia, MG");
  assert.match(ler("src/components/account/casca-conta.tsx"), /\{children\}\s*<FechamentoConta \/>/);
  assert.match(ler("src/components/account/conta-menu.tsx"), /<FechamentoConta \/>/);
  const css = ler("src/app/globals.css");
  assert.match(css, /\[data-painel-main\]:has\(\[data-conta-casca\]\),\s*html:not\(\[data-app\]\) \[data-painel-main\]:has\(\[data-testid="conta-menu"\]\) \{\s*padding-bottom: 2rem;/);
});
