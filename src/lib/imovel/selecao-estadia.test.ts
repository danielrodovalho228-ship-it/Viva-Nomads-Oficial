/*
  E53 — o calendário, a caixa de reserva e o "Solicitar" são UMA seleção (entrada, saída, pessoas).
  Roda: node --test src/lib/imovel/selecao-estadia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SELECAO_VAZIA, clicarDia, comEntrada, comPessoas, comSaida, diasDaSelecao, linhaPeriodoNaMensagem, mesesDaSelecao } from "./selecao-estadia.ts";
import { resumoSolicitacao } from "../reserva-imovel.ts";
import { formatBRL } from "../utils.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const valor = (r: ReturnType<typeof resumoSolicitacao>, rotulo: string) => r.linhas.find((l) => l.rotulo === rotulo)?.valor;

test("calendário: 1º clique = entrada, 2º = saída; antes da entrada recomeça; com período completo recomeça", () => {
  const a = clicarDia(SELECAO_VAZIA, "2026-11-24");
  assert.deepEqual(a, { entrada: "2026-11-24", saida: "", pessoas: 1 });
  const b = clicarDia(a, "2026-12-24");
  assert.deepEqual(b, { entrada: "2026-11-24", saida: "2026-12-24", pessoas: 1 });
  assert.deepEqual(clicarDia(a, "2026-11-20"), { entrada: "2026-11-20", saida: "", pessoas: 1 });
  assert.deepEqual(clicarDia(a, "2026-11-24"), { entrada: "2026-11-24", saida: "", pessoas: 1 }, "mesmo dia não é saída");
  assert.deepEqual(clicarDia(b, "2027-01-05"), { entrada: "2027-01-05", saida: "", pessoas: 1 });
  assert.equal(clicarDia({ ...b, pessoas: 3 }, "2027-01-05").pessoas, 3, "pessoas não se perdem no calendário");
});

test("campos: entrada nova derruba a saída que ficaria antes; saída fica como digitada; pessoas ≥ 1", () => {
  const p = { entrada: "2026-11-24", saida: "2026-12-24", pessoas: 2 };
  assert.equal(comEntrada(p, "2026-12-01").saida, "2026-12-24");
  assert.equal(comEntrada(p, "2026-12-24").saida, "");
  assert.equal(comEntrada(p, "").saida, "2026-12-24", "apagar a entrada não apaga a saída");
  assert.equal(comSaida(p, "2026-11-01").saida, "2026-11-01");
  assert.equal(comPessoas(p, 4).pessoas, 4);
  assert.equal(comPessoas(p, 0).pessoas, 1);
  assert.equal(comPessoas(p, Number.NaN).pessoas, 1);
});

test("período: 24/11 → 24/12/2026 = 30 dias = 1 mês; 45 dias = 2 meses; sem período completo = null", () => {
  assert.equal(diasDaSelecao({ entrada: "2026-11-24", saida: "2026-12-24" }), 30);
  assert.equal(mesesDaSelecao({ entrada: "2026-11-24", saida: "2026-12-24" }), 1);
  assert.equal(mesesDaSelecao({ entrada: "2026-11-24", saida: "2027-01-08" }), 2);
  assert.equal(mesesDaSelecao({ entrada: "2026-11-24", saida: "" }), null);
  assert.equal(mesesDaSelecao({ entrada: "2026-11-24", saida: "2026-11-01" }), null);
  // Horário de verão / fuso não muda a conta (meio-dia UTC).
  assert.equal(diasDaSelecao({ entrada: "2026-10-01", saida: "2026-11-01" }), 31);
});

test("resumo do Solicitar: entrada e saída da seleção, erro de saída antes da entrada, total da estadia recalcula", () => {
  const base = { monthlyPrice: 2400, hoje: "2026-10-24", totalMensal: 2750 };
  const r = resumoSolicitacao({ ...base, inicioDesejado: "2026-11-24", fimDesejado: "2026-12-24" });
  assert.equal(r.erro, null);
  assert.equal(valor(r, "Entrada"), "24/11/2026");
  assert.equal(valor(r, "Saída"), "24/12/2026 (30 dias)");
  assert.equal(valor(r, "Total da estadia"), `${formatBRL(2750)} em 1 mês`);
  // Alterar a saída no diálogo → o total acompanha.
  const r2 = resumoSolicitacao({ ...base, inicioDesejado: "2026-11-24", fimDesejado: "2027-02-22" });
  assert.equal(valor(r2, "Total da estadia"), `${formatBRL(8250)} em 3 meses`);
  // Sem saída: não inventa total da estadia; a saída fica a combinar.
  const r3 = resumoSolicitacao({ ...base, inicioDesejado: "2026-11-24" });
  assert.equal(valor(r3, "Saída"), "A combinar com o proprietário");
  assert.equal(valor(r3, "Total da estadia"), undefined);
  assert.match(resumoSolicitacao({ ...base, inicioDesejado: "2026-11-24", fimDesejado: "2026-11-20" }).erro ?? "", /saída precisa ser depois da entrada/);
});

test("a saída chega ao dono numa linha da mensagem (sem coluna própria no pedido)", () => {
  assert.equal(linhaPeriodoNaMensagem({ entrada: "2026-11-24", saida: "2026-12-24" }), "Período escolhido: 24/11/2026 a 24/12/2026 (30 dias).");
  assert.equal(linhaPeriodoNaMensagem({ entrada: "2026-11-24", saida: "" }), null);
});

test("uma fonte só: o calendário não guarda datas; caixa e diálogo usam os mesmos campos da mesma seleção", () => {
  const cal = ler("components/property/availability-calendar.tsx");
  assert.doesNotMatch(cal, /setCheckIn|setCheckOut/, "o calendário não tem estado próprio de entrada/saída");
  assert.match(cal, /onSelecao\(proximaSelecao\(selecao, iso\)\)/);
  const pagina = ler("app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(pagina, /useState<SelecaoEstadia>\(SELECAO_VAZIA\)/);
  assert.doesNotMatch(pagina, /setInicioDesejado|setPessoas/, "nenhum estado paralelo de data ou pessoas");
  assert.match(pagina, /<AvailabilityCalendar property=\{property\} selecao=\{selecao\} onSelecao=\{setSelecao\} \/>/);
  assert.match(pagina, /\{camposPeriodo\("candidatura"\)\}/);
  assert.match(pagina, /\{camposPeriodo\("solicitacao"\)\}/);
  assert.match(pagina, /fimDesejado: selecao\.saida/);
  assert.match(pagina, /mesesDaSelecao\(selecao\) \?\?/);
});
