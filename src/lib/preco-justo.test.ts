/*
  Preço justo (ordem 4c74ac38, item 1): "Quanto você recebe" Airbnb × Viva e preço sugerido.
  Roda: node --test src/lib/preco-justo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { precoSugerido, recebeAirbnb, recebeViva, economiaDoMorador } from "./preco-justo.ts";

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
  const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  assert.match(pagina, /<PrecoSugerido aluguel=\{Number\(monthlyPrice\) \|\| 0\} onUsar=/);
  const comp = readFileSync("src/components/precos/preco-sugerido.tsx", "utf8");
  assert.match(comp, /Usar preço sugerido/);
  assert.doesNotMatch(comp, /aluguel pretendido|comiss[ãa]o|corretagem/i);
});
