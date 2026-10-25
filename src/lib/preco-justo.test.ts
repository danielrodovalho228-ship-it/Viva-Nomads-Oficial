/*
  Preço justo (ordem 4c74ac38, item 1): "Quanto você recebe" Airbnb × Viva e preço sugerido.
  Roda: node --test src/lib/preco-justo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { precoSugerido, recebeAirbnb, recebeViva, economiaDoMorador, taxaDoNovoAnuncio, temSeloPrecoJusto, prioridadeNaBusca, colunaAirbnb } from "./preco-justo.ts";

test("Airbnb: R$ 10.300 por 2 meses → dono recebe R$ 8.652 (taxa de 16%)", () => {
  assert.equal(recebeAirbnb(10300), 8652);
});

test("Viva: a taxa vale sobre o valor TOTAL do contrato (3.000 × 3 × 12% = 1.080)", () => {
  assert.equal(recebeViva(3000, 3, 0.12), 9000 - 1080);
});

test("preço sugerido faz o dono receber ao menos o mesmo que no Airbnb", () => {
  const p = precoSugerido(10300, 2, 0.12);
  assert.ok(p !== null && recebeViva(p, 2, 0.12) >= recebeAirbnb(10300));
  assert.equal(p, 4916);
  // e um real a menos já não alcança
  assert.ok(recebeViva(4915, 2, 0.12) < recebeAirbnb(10300));
});

test("morador paga menos que no Airbnb com o preço sugerido", () => {
  const p = precoSugerido(10300, 2, 0.12)!;
  const e = economiaDoMorador(10300, p, 2);
  assert.equal(e.reais, 10300 - 4916 * 2);
  assert.ok(e.pct > 0 && e.pct < 0.1);
});

test("entrada inválida não quebra: devolve null / zero", () => {
  assert.equal(precoSugerido(0, 2, 0.12), null);
  assert.equal(precoSugerido(10300, 0, 0.12), null);
  assert.equal(precoSugerido(10300, 2, 1), null);
  assert.equal(precoSugerido(Number.NaN, 2, 0.12), null);
  assert.equal(recebeAirbnb(-5), 0);
  assert.equal(recebeViva(0, 2, 0.12), 0);
  assert.deepEqual(economiaDoMorador(0, 100, 2), { reais: 0, pct: 0 });
});

test("o passo de preço do cadastro mostra o PrecoSugerido (opcional) e o botão usa o preço sugerido", async () => {
  const { readFileSync } = await import("node:fs");
  const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx", "utf8");
  assert.match(pagina, /<PrecoSugerido aluguel=\{aluguel\} meses=\{mesesExemplo\} taxa=\{taxa\} onUsar=/);
  assert.match(pagina, /const aluguel = Number\(p\.monthlyPrice\) \|\| 0;/);
  const comp = readFileSync("src/components/precos/preco-sugerido.tsx", "utf8");
  assert.match(comp, /Usar \{brlTaxa\(sugerido\)\}\/mês como valor mensal/);
  assert.doesNotMatch(comp, /\b(comissão|corretagem)\b/i);
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
