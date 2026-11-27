/*
  E562 (E-DIAS): estadia em dias exatos (30 a 180), preço proporcional — uma regra só.
  Total da estadia = Total por mês × dias ÷ 30 (contas, condomínio e taxa pet pela mesma regra); a limpeza única fica
  inteira; o pacote de limpezas = round(limpezas por mês × dias ÷ 30), ajustável pelo dono; a taxa da Viva e a caução
  (50% do bloco, bloco de até 90 dias) saem do valor proporcional.
  Roda: node --test src/lib/estadia-em-dias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blocosEmDias,
  diasValidos,
  limpezasDoPacote,
  mesesDeReferencia,
  proporcional,
  taxaSobreDias,
  totalDaEstadia,
} from "./estadia-em-dias.ts";
import { comissaoSobreContrato } from "./cobranca/regra.ts";
import { calcularTotais, taxaServicoProposta, type TermosProposta } from "./propostas/regras.ts";
import { precoDaProposta } from "./precos.ts";
import { periodoDaCandidatura } from "./notifications/dados-candidatura.ts";
import { encadearDatas, resumoContrato, resumoContratoEmDias } from "./contrato-blocos.ts";

const MES = { mensal: 3000, condominio: 300, consumo: 150, taxaPet: 50, limpezasMes: 0, valorLimpeza: 0, limpezaUnica: 0 };
// Total por mês sem limpezas: 3.000 + 300 + 150 + 50 = 3.500.

test("dias válidos: inteiros de 30 a 180", () => {
  assert.equal(diasValidos(30), true);
  assert.equal(diasValidos(180), true);
  assert.equal(diasValidos(29), false);
  assert.equal(diasValidos(181), false);
  assert.equal(diasValidos(43.5), false);
});

test("meses viram referência derivada (para cima): 30→1, 32→2, 43→2, 90→3, 91→4, 180→6", () => {
  assert.deepEqual([30, 32, 43, 90, 91, 180].map(mesesDeReferencia), [1, 2, 2, 3, 4, 6]);
});

test("32 dias ≠ 2 meses: cobra 32/30 do mensal", () => {
  const t = totalDaEstadia({ ...MES, dias: 32 });
  assert.equal(t.total, proporcional(3500, 32));
  assert.equal(t.total, 3733.33);
  assert.notEqual(t.total, 3500 * 2);
});

test("43 dias = 1 mês + 13 dias", () => {
  const t = totalDaEstadia({ ...MES, dias: 43 });
  assert.equal(t.total, Math.round((3500 + (3500 * 13) / 30) * 100) / 100);
  assert.equal(t.total, 5016.67);
});

test("limpeza única de saída fica inteira; o pacote de limpezas arredonda e o dono pode ajustar", () => {
  assert.equal(limpezasDoPacote(4, 43), 6); // 4 × 43/30 = 5,73 → 6
  assert.equal(limpezasDoPacote(2, 32), 2); // 2,13 → 2
  const auto = totalDaEstadia({ ...MES, dias: 43, limpezasMes: 4, valorLimpeza: 100, limpezaUnica: 250 });
  assert.equal(auto.limpezasPacote, 6);
  assert.equal(auto.total, 5016.67 + 600 + 250);
  const ajustado = totalDaEstadia({ ...MES, dias: 43, limpezasMes: 4, valorLimpeza: 100, limpezasPacote: 5, limpezaUnica: 250 });
  assert.equal(ajustado.limpezasPacote, 5);
  assert.equal(ajustado.total, 5016.67 + 500 + 250);
});

test("em meses cheios o total é o de antes (propostas antigas intactas)", () => {
  for (const meses of [1, 2, 3, 4, 5, 6]) {
    const t = totalDaEstadia({ ...MES, dias: meses * 30, limpezasMes: 3, valorLimpeza: 90, limpezaUnica: 200 });
    assert.equal(t.total, (3500 + 3 * 90) * meses + 200);
  }
});

test("90 dias = 1 bloco; 91 dias = 2 blocos (o 2º com 1 dia)", () => {
  assert.deepEqual(blocosEmDias(90, 3000).map((b) => b.dias), [90]);
  assert.deepEqual(blocosEmDias(91, 3000).map((b) => b.dias), [90, 1]);
  assert.deepEqual(blocosEmDias(180, 3000).map((b) => b.dias), [90, 90]);
  assert.deepEqual(blocosEmDias(43, 3000).map((b) => b.dias), [43]);
});

test("caução = 50% do bloco proporcional (bloco = aluguel × dias ÷ 30), com o teto de 3 aluguéis", () => {
  const [b] = blocosEmDias(43, 3000);
  assert.equal(b.valor, 4300);
  assert.equal(b.caucao, 2150);
  assert.equal(b.meses, 2); // referência para a coluna contrato_blocos.meses (1..3)
  const dois = blocosEmDias(91, 3000);
  assert.equal(dois[0].valor, 9000);
  assert.equal(dois[0].caucao, 4500);
  assert.equal(dois[1].valor, 100);
  assert.equal(dois[1].caucao, 50);
});

test("taxa da Viva sobre o valor proporcional (43 dias × 10% de 3.000 = 430)", () => {
  assert.equal(taxaSobreDias(3000, 43, 0.1), 430);
  // Meses cheios: o mesmo valor da fórmula única de antes.
  assert.equal(taxaSobreDias(3000, 90, 0.12), comissaoSobreContrato(3000, 3, 0.12));
});

const TERMOS: TermosProposta = {
  valorBase: 3000,
  descontoPct: 0,
  descontoValor: 0,
  motivoDesconto: null,
  descontoEstadiaPct: 0,
  meses: 2,
  dias: 43,
  dataEntrada: "2026-12-01",
  condominio: 300,
  consumo: 150,
  limpezasMes: 4,
  valorLimpeza: 100,
  taxaPet: 50,
  limpezaUnica: 250,
};

test("a proposta usa a mesma regra: total, taxa e conta pelos dias", () => {
  const tot = calcularTotais(TERMOS);
  assert.equal(tot.totalContrato, totalDaEstadia({ ...MES, dias: 43, limpezasMes: 4, valorLimpeza: 100, limpezaUnica: 250 }).total);
  assert.equal(tot.baseTaxa, 4300);
  assert.equal(taxaServicoProposta(TERMOS, 0.1), 430);
  const preco = precoDaProposta({ ...TERMOS, valorMensal: tot.valorMensal });
  assert.equal(preco.totalContrato, tot.totalContrato);
  assert.match(preco.conta ?? "", /43 dias/);
});

test("proposta antiga (sem dias) segue pelos meses: dias = meses × 30, mesmo total e mesma conta", () => {
  const antiga = { ...TERMOS, dias: undefined, meses: 3, limpezasMes: 2 };
  const tot = calcularTotais(antiga);
  assert.equal(tot.totalContrato, (3000 + 300 + 150 + 50 + 2 * 100) * 3 + 250);
  assert.equal(tot.baseTaxa, 9000);
  assert.equal(taxaServicoProposta(antiga, 0.1), comissaoSobreContrato(3000, 3, 0.1));
  assert.match(precoDaProposta({ ...antiga, valorMensal: 3000 }).conta ?? "", /^3 × /);
});

test("candidatura → proposta: os dias saem exatos do período (sem arredondar para meses)", () => {
  assert.equal(periodoDaCandidatura("2026-12-01", "2027-01-13")?.dias, 43);
});

test("contrato pela proposta: prazo em dias e blocos de até 90 dias contados em dias", () => {
  const r = resumoContratoEmDias(91, 3000, 0.1, 3);
  assert.equal(r.prazoTotalDias, 91);
  assert.deepEqual(r.blocos.map((b) => b.dias), [90, 1]);
  assert.equal(r.comissaoValor, 910);
  const datas = encadearDatas("2026-12-01", r.blocos);
  assert.equal(datas[0].fim, "2027-02-28");
  assert.equal(datas[1].inicio, "2027-03-01");
  assert.equal(datas[1].fim, "2027-03-01");
  // O tamanho do bloco do Fechamento (padrão 2 meses = 60 dias) continua valendo, contado em dias.
  assert.deepEqual(resumoContratoEmDias(43, 3000, 0.1, 2).blocos.map((b) => b.dias), [43]);
  assert.deepEqual(resumoContratoEmDias(91, 3000, 0.1, 2).blocos.map((b) => b.dias), [60, 31]);
});

test("contrato em meses cheios pela regra em dias = o contrato de antes", () => {
  const antes = resumoContrato(4, 3000, 0.1, 2);
  const agora = resumoContratoEmDias(120, 3000, 0.1, 2);
  assert.deepEqual(agora.blocos.map((b) => [b.meses, b.valor, b.caucao]), antes.blocos.map((b) => [b.meses, b.valor, b.caucao]));
  assert.equal(agora.comissaoValor, antes.comissaoValor);
  assert.equal(agora.prazoTotalDias, 120);
  assert.deepEqual(encadearDatas("2026-12-01", agora.blocos).map((b) => b.fim), encadearDatas("2026-12-01", antes.blocos).map((b) => b.fim));
});
