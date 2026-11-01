/*
  Preço justo (ordem 4c74ac38, item 1). E292-bis: a conta do Airbnb (recebeAirbnb, 16%, e precoSugerido) saiu — só
  ficam a conta da Viva, a economia sobre um total informado e o selo (decisão pendente do coordenador).
  Roda: node --test src/lib/preco-justo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as precoJusto from "./preco-justo.ts";
import { recebeViva, economiaDoMorador, taxaDoNovoAnuncio, temSeloPrecoJusto, prioridadeNaBusca, colunaAirbnb } from "./preco-justo.ts";
import { MERCADO } from "../config/planos.ts";

test("Viva: a taxa vale sobre o valor TOTAL do contrato (3.000 × 3 × 12% = 1.080)", () => {
  assert.equal(recebeViva(3000, 3, 0.12), 9000 - 1080);
});

test("economia do morador sobre um total informado", () => {
  const e = economiaDoMorador(10300, 4916, 2);
  assert.equal(e.reais, 10300 - 4916 * 2);
  assert.ok(e.pct > 0 && e.pct < 0.1);
});

test("entrada inválida não quebra: devolve zero", () => {
  assert.equal(recebeViva(0, 2, 0.12), 0);
  assert.deepEqual(economiaDoMorador(0, 100, 2), { reais: 0, pct: 0 });
});

test("E292-bis: sem a conta do Airbnb — nem recebeAirbnb, nem precoSugerido, nem a taxa de 16% em MERCADO", () => {
  assert.equal("recebeAirbnb" in precoJusto, false);
  assert.equal("precoSugerido" in precoJusto, false);
  assert.equal("airbnbTaxa" in MERCADO, false);
  assert.doesNotMatch(readFileSync(new URL("./preco-justo.ts", import.meta.url), "utf8"), /MERCADO|airbnbTaxa/);
});

test("taxaDoNovoAnuncio: faixa pelos ativos já contando o anúncio novo", () => {
  assert.equal(taxaDoNovoAnuncio(0), 0.12);
  assert.equal(taxaDoNovoAnuncio(1), 0.12); // 2º imóvel ainda na faixa 1–2
  assert.equal(taxaDoNovoAnuncio(2), 0.1); // 3º imóvel entra na faixa 3–5
  assert.equal(taxaDoNovoAnuncio(5), 0.08);
  assert.equal(taxaDoNovoAnuncio(15), 0.06);
  assert.equal(taxaDoNovoAnuncio(NaN), 0.12);
  assert.equal(taxaDoNovoAnuncio(-3), 0.12);
});

test("selo Preço justo: só quando o aluguel fica abaixo do Airbnb informado", () => {
  assert.equal(temSeloPrecoJusto(4602, 5150), true);
  assert.equal(temSeloPrecoJusto(5150, 5150), false); // igual não ganha selo
  assert.equal(temSeloPrecoJusto(6000, 5150), false);
});

test("selo Preço justo: campo opcional ou inválido nunca gera selo", () => {
  assert.equal(temSeloPrecoJusto(4602, null), false);
  assert.equal(temSeloPrecoJusto(4602, undefined), false);
  assert.equal(temSeloPrecoJusto(4602, 0), false);
  assert.equal(temSeloPrecoJusto(4602, -1), false);
  assert.equal(temSeloPrecoJusto(4602, Number.NaN), false);
  assert.equal(temSeloPrecoJusto(0, 5000), false);
});

test("impulso na busca: desempata dentro do mesmo degrau, nunca passa o degrau de cima", () => {
  assert.ok(prioridadeNaBusca(1, true) > prioridadeNaBusca(1, false));
  assert.ok(prioridadeNaBusca(1, true) < prioridadeNaBusca(2, false));
  assert.equal(prioridadeNaBusca(2, undefined), 2);
});

test("colunaAirbnb: undefined não mexe; inválido limpa; válido arredonda em centavos", () => {
  assert.deepEqual(colunaAirbnb(undefined), {});
  assert.deepEqual(colunaAirbnb(0), { airbnb_monthly_price: null });
  assert.deepEqual(colunaAirbnb(-5), { airbnb_monthly_price: null });
  assert.deepEqual(colunaAirbnb(Number.NaN), { airbnb_monthly_price: null });
  assert.deepEqual(colunaAirbnb(5_000_000), { airbnb_monthly_price: null });
  assert.deepEqual(colunaAirbnb(5150.456), { airbnb_monthly_price: 5150.46 });
});
