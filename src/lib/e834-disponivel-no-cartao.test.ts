/*
  E834 — trava nomeada (ORDEM-DUET-227). O item: "datas de disponibilidade dos cartões sem explicação: o cartão sinaliza
  'disponível a partir de DD/MM' de forma compreensível na própria vitrine". Na main 089d0734 já é assim: o cartão
  (property-card.tsx, cartao-disponivel) mostra "Disponível a partir de DD/MM/AAAA" para data futura e "Disponível agora"
  para hoje ou data passada (rotuloPreco → disponivelAPartirDe, dia de Brasília). Esta trava prende o texto e o lugar.
  Roda: node --test src/lib/e834-disponivel-no-cartao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rotuloPreco } from "./cartao-preco.ts";
import { modeloDoCartao } from "./cartao-modelo.ts";

const HOJE = new Date("2026-11-20T15:00:00Z"); // 12:00 em Brasília

test("E834 — data futura: o cartão diz 'Disponível a partir de DD/MM/AAAA', com a palavra, não só a data", () => {
  const r = rotuloPreco({ mensal: 3000, meses: 3, disponivelEm: "2026-12-05", hoje: HOJE });
  assert.equal(r.disponivel, "Disponível a partir de 05/12/2026");
});

test("E834 — hoje ou data passada: 'Disponível agora' (nunca uma data solta)", () => {
  for (const d of ["2026-11-20", "2026-10-01"]) assert.equal(rotuloPreco({ mensal: 3000, disponivelEm: d, hoje: HOJE }).disponivel, "Disponível agora", d);
  assert.equal(rotuloPreco({ mensal: 3000, hoje: HOJE }).disponivel, null, "sem data, sem linha");
});

test("E834 — a linha aparece NA VITRINE: o cartão da busca mostra o texto do rótulo", () => {
  const cartao = readFileSync("src/components/property-card.tsx", "utf8");
  assert.match(cartao, /data-testid="cartao-disponivel"[\s\S]{0,80}\{m\.disponivel\}/);
  const modelo = readFileSync("src/lib/cartao-modelo.ts", "utf8");
  assert.match(modelo, /disponivel: preco\.disponivel/, "o modelo do cartão leva o texto do rótulo");
  assert.equal(typeof modeloDoCartao, "function");
});
