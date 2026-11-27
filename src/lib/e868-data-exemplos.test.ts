/*
  E868 — a data "Disponível a partir de" dos exemplos: o cartão da busca mostrava 1 dia DEPOIS da página do mesmo anúncio
  (15/15). Causa: as datas eram calculadas UMA vez, na carga do módulo, pelo dia UTC; a busca e a página rodam em instâncias
  carregadas em dias diferentes (perto da meia-noite UTC, que é 21h em Brasília). Agora a data é lida a cada acesso, pelo dia
  de Brasília — uma fonte só para o cartão, a página e o estado vazio da busca.
  Roda: node --test src/lib/e868-data-exemplos.test.ts
*/
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const DIA = 86_400_000;
// 12/11/2026 às 21h30 em Brasília = 13/11 00h30 UTC: o horário em que o RELATORIO-020 viu o +1.
const T0 = Date.parse("2026-11-13T00:30:00Z");

test("a data do exemplo acompanha o relógio (não congela na carga do módulo) e usa o dia de Brasília", async () => {
  mock.timers.enable({ apis: ["Date"], now: T0 - 2 * DIA }); // o módulo carrega dois dias antes
  const { SAMPLE_PROPERTIES } = await import("./properties.ts");
  const ube001 = () => SAMPLE_PROPERTIES.find((p) => p.id === "ube-001")!;
  mock.timers.setTime(T0);
  // Em Brasília ainda é 12/11 → 12/11 + 11 dias = 23/11 (a data que a página mostrava).
  assert.equal(ube001().availableFrom, "2026-11-23");
  mock.timers.setTime(T0 + DIA);
  assert.equal(ube001().availableFrom, "2026-11-24");
  mock.timers.reset();
});

test("cartão, página e estado vazio leem a MESMA data", async () => {
  mock.timers.enable({ apis: ["Date"], now: T0 });
  const { SAMPLE_PROPERTIES } = await import("./properties.ts");
  const { rotuloPreco } = await import("./cartao-preco.ts");
  const { proximaDisponibilidade } = await import("./busca-vazia.ts");
  const hojeBR = "2026-11-12";
  for (const p of SAMPLE_PROPERTIES) {
    // Cartão: rotuloPreco({ disponivelEm: property.availableFrom }); página (PriceCard): rotuloPreco({ disponivelEm: disponivelDesde ?? property.availableFrom }).
    // Objeto serializado (como o servidor manda ao navegador) traz a mesma data do objeto lido no servidor.
    const serializado = JSON.parse(JSON.stringify(p)) as typeof p;
    const cartao = rotuloPreco({ mensal: 1000, disponivelEm: p.availableFrom, hoje: new Date(T0) }).disponivel;
    const pagina = rotuloPreco({ mensal: 1000, disponivelEm: serializado.availableFrom, hoje: new Date(T0) }).disponivel;
    assert.equal(cartao, pagina, p.id);
    assert.equal(serializado.availableFrom, p.availableFrom, p.id);
  }
  // O estado vazio usa a mesma data do cartão do exemplo que libera primeiro.
  const primeiro = [...SAMPLE_PROPERTIES].sort((a, b) => String(a.availableFrom).localeCompare(String(b.availableFrom)))[0];
  assert.equal(proximaDisponibilidade(SAMPLE_PROPERTIES.map((p) => ({ availableFrom: p.availableFrom, availableUntil: p.availableUntil })) as never, hojeBR), primeiro.availableFrom);
  assert.equal(SAMPLE_PROPERTIES.find((p) => p.id === "ube-001")!.availableFrom, "2026-11-23");
  assert.equal(SAMPLE_PROPERTIES.find((p) => p.id === "ube-002")!.availableFrom, "2026-11-27");
  assert.equal(SAMPLE_PROPERTIES.find((p) => p.id === "ube-003")!.availableFrom, "2026-12-01");
  mock.timers.reset();
});

test("o rótulo do cartão compara com o dia de Brasília (às 21h30 de 12/11, o dia 13/11 ainda é futuro)", async () => {
  const { disponivelAPartirDe } = await import("./busca/disponibilidade.ts");
  assert.equal(disponivelAPartirDe("2026-11-13", new Date(T0)), "13/11/2026");
  assert.equal(disponivelAPartirDe("2026-11-12", new Date(T0)), null);
});
