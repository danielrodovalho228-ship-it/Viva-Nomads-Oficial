/*
  E1072 (fatia 3; ORDEM-DUET-352) — o quadro "1º pagamento" do Fechamento e da proposta, na estadia em DIAS.
  O registro do bloco cobra o que o contrato diz: o valor do bloco + as contas do período + a limpeza de preparação
  (R$ 3.143,33 no contrato provado ao vivo em 20/11). O quadro "1º pagamento" ainda dizia R$ 3.050,00 (um mês cheio +
  a limpeza): o dono combinava um número com o morador e a plataforma pedia outro no registro.
  Na estadia em dias que não fecha meses cheios, o quadro passa a dizer o 1º bloco, pela MESMA conta do registro.
  Em meses inteiros o quadro não muda (o 1º mês + a limpeza de preparação) — isso tem decisão própria por tomar.
  Roda: node --test src/lib/e1072-primeiro-pagamento-em-dias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumoContrato, resumoContratoEmDias } from "./contrato-blocos.ts";
import { precoDaProposta, primeiroPagamentoDoPreco } from "./precos.ts";
import { componentesDosBlocos, contaDoPrimeiroPagamento, contasDoContrato, fatorDoBloco, primeiroPagamentoDaEstadia } from "./pagamento-componentes.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// O contrato provado: 31 dias, R$ 2.500,00 por mês, contas de R$ 300,00 por mês, limpeza de preparação de R$ 250,00.
const TERMOS_31 = { valorMensal: 2500, meses: 2, dias: 31, condominio: 0, consumo: 300, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, limpezaUnica: 250 };

test("o contrato provado (31 dias): o 1º pagamento é R$ 3.143,33, não R$ 3.050,00", () => {
  const preco = precoDaProposta(TERMOS_31);
  assert.equal(preco.totalContrato, 3143.33);
  // A conta antiga do quadro: um mês cheio + a limpeza.
  assert.equal(primeiroPagamentoDoPreco(preco), 3050);
  const blocos = resumoContratoEmDias(31, 2500, 0).blocos;
  assert.equal(primeiroPagamentoDaEstadia({ dias: 31, preco, blocos, comProposta: true }), 3143.33);
});

test("é a MESMA conta do registro do bloco (componentesDosBlocos)", () => {
  const preco = precoDaProposta(TERMOS_31);
  const blocos = resumoContratoEmDias(31, 2500, 0).blocos;
  const aluguel = blocos.reduce((s, b) => s + b.valor, 0);
  const esperadoNoRegistro = componentesDosBlocos({
    blocos: blocos.map((b) => ({ numero: b.numero, valor: b.valor, fator: (b.dias ?? b.meses * 30) / 30 })),
    contasDoContrato: contasDoContrato({ totalContratoDaProposta: preco.totalContrato, aluguelDosBlocos: aluguel, limpezaPreparacao: 250, fatorDaEstadia: 31 / 30 }),
    limpezaPreparacao: 250,
  }).get(1)!;
  assert.deepEqual(esperadoNoRegistro, { aluguel: 2583.33, contas: 310, limpeza: 250, total: 3143.33 });
  assert.equal(primeiroPagamentoDaEstadia({ dias: 31, preco, blocos, comProposta: true }), esperadoNoRegistro.total);
  // O fator do bloco em dias é o que a carga do contrato usa (dias do bloco ÷ 30).
  assert.equal(fatorDoBloco({ meses: 2, inicio: "2027-01-10", fim: "2027-02-09" }, 31), 31 / 30);
});

test("estadia em dias com mais de um bloco: o 1º pagamento é o 1º bloco, com as contas do período dele e a limpeza", () => {
  // 100 dias a R$ 3.000,00 por mês, contas de R$ 300,00 por mês, limpeza de R$ 250,00 → blocos de 60 e 40 dias.
  const termos = { ...TERMOS_31, valorMensal: 3000, dias: 100, meses: 4 };
  const preco = precoDaProposta(termos);
  const blocos = resumoContratoEmDias(100, 3000, 0).blocos;
  assert.deepEqual(blocos.map((b) => b.dias), [60, 40]);
  // 1º bloco: 6.000,00 + contas de 60 dias (600,00) + limpeza 250,00.
  assert.equal(primeiroPagamentoDaEstadia({ dias: 100, preco, blocos, comProposta: true }), 6850);
});

test("sem proposta (candidatura em dias): as contas do mês do anúncio × os dias do bloco ÷ 30", () => {
  const preco = precoDaProposta({ ...TERMOS_31, dias: 0, meses: 2 }); // o preço do anúncio vem em meses
  const blocos = resumoContratoEmDias(31, 2500, 0).blocos;
  assert.equal(primeiroPagamentoDaEstadia({ dias: 31, preco, blocos, comProposta: false }), 3143.33);
});

test("meses inteiros: o quadro NÃO muda — o 1º mês com tudo + a limpeza de preparação", () => {
  const preco = precoDaProposta({ ...TERMOS_31, valorMensal: 3200, consumo: 400, dias: 120, meses: 4 });
  const blocos = resumoContrato(4, 3200, 0).blocos;
  for (const dias of [120, null, 0]) assert.equal(primeiroPagamentoDaEstadia({ dias, preco, blocos, comProposta: true }), primeiroPagamentoDoPreco(preco));
  assert.equal(primeiroPagamentoDoPreco(preco), 3850);
});

test("a conta por extenso acompanha o número em dias (as parcelas do mês da tela não somam o 1º bloco); em meses não há conta", () => {
  const preco = precoDaProposta(TERMOS_31);
  const blocos = resumoContratoEmDias(31, 2500, 0).blocos;
  assert.equal(
    contaDoPrimeiroPagamento({ dias: 31, preco, blocos, comProposta: true }),
    "valor do bloco R$ 2.583,33 + contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 3.143,33",
  );
  const mensal = precoDaProposta({ ...TERMOS_31, dias: 120, meses: 4 });
  assert.equal(contaDoPrimeiroPagamento({ dias: 120, preco: mensal, blocos: resumoContrato(4, 2500, 0).blocos, comProposta: true }), "");
});

test("as duas telas usam a função única", () => {
  const fechamento = ler("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(fechamento, /primeiroPagamento: primeiroPagamentoDaEstadia\(\{ dias: DIAS_ACORDO, preco: PRECO_FECHAMENTO, blocos: resumo\.blocos, comProposta: !!ACORDO\?\.termos \}\)/);
  const proposta = ler("src/app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  assert.match(proposta, /rotulo="1º pagamento" valor=\{formatBRLExato\(primeiroPagamentoDaVersao\(v\)\)\}/);
  assert.match(proposta, /primeiroPagamentoDaEstadia\(/);
  // A conta por extenso aparece nas duas telas, só quando existe (estadia em dias).
  assert.match(fechamento, /data-testid="entrada-primeiro-pagamento-conta"/);
  assert.match(proposta, /data-testid="proposta-primeiro-pagamento-conta"/);
});
