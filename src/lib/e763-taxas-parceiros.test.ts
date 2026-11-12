/* E763 — duas taxas, duas legendas. Roda: node --test src/lib/e763-taxas-parceiros.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXAS_PROPRIETARIO_TEXTO, ROTULO_TAXA_PARCEIRO, ROTULO_TAXA_PROPRIETARIO } from "./parceiros/taxas-texto.ts";
import { TEXTO_REGRA_90_10 } from "../config/taxa-servico-parceiros.ts";

test("as faixas do proprietário saem da tabela da cobrança: 12/10/8/6, sem o 4% do Gestor", () => {
  assert.equal(FAIXAS_PROPRIETARIO_TEXTO, "12% (1–2 imóveis), 10% (3–5), 8% (6–15), 6% (16–19)");
  assert.doesNotMatch(FAIXAS_PROPRIETARIO_TEXTO, /4%/);
});

test("o 10% do parceiro é rotulado como outra taxa (90/10), e a regra 90/10 segue a mesma da página de cadastro", () => {
  assert.match(ROTULO_TAXA_PARCEIRO, /10% sobre cada serviço/);
  assert.match(ROTULO_TAXA_PARCEIRO, /não a do proprietário/);
  assert.match(TEXTO_REGRA_90_10, /10% são a taxa de serviço/);
  assert.match(ROTULO_TAXA_PROPRIETARIO, /^Taxa do proprietário, por contrato fechado/);
});

test("/parceiros usa os dois rótulos (cartão Gestores e dúvida 'Quanto custa?')", () => {
  const pagina = readFileSync("src/app/(public)/parceiros/page.tsx", "utf8");
  assert.match(pagina, /\$\{ROTULO_TAXA_PROPRIETARIO\} Plano Gestor/);
  assert.match(pagina, /ROTULO_TAXA_PARCEIRO/);
});
