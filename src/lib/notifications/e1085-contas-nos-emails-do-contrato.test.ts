/*
  E1085 (ORDEM-DUET-420/421, classe B): as contas não tinham linha própria nos e-mails do contrato — os R$ 300/mês
  viviam implícitos dentro da conta do "Total do contrato". A composição ganha as linhas das contas, DA MESMA FONTE do
  E1066 (precoDaProposta da proposta acordada: as parcelas do mês além do aluguel, com o rótulo da fonte), nos três
  e-mails: geração, "falta a sua assinatura" e "contrato assinado" (os três montam o quadro por linhasContrato).
  Sem proposta acordada (ou sem contas): nenhuma linha nova — o quadro de antes.
  Roda: node --test src/lib/notifications/e1085-contas-nos-emails-do-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contasDoContrato, linhasContrato } from "./dados-negociacao.ts";
import { precoDaProposta } from "../precos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const IM = { id: "x", titulo: "Apto Centro", bairro: "Centro", cidade: "Uberlândia" };
const ACORDADA = {
  valorMensal: 2500,
  meses: 1,
  termos: { condominio: 0, consumo: 300, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, limpezaUnica: 0, dias: 30, limpezasPacote: null },
};

test("E1085 — as contas saem da fonte única (as parcelas do mês da proposta acordada, além do aluguel), por mês", () => {
  const fonte = precoDaProposta({ ...ACORDADA.termos, valorMensal: 2500, meses: 1 }).parcelasMes.slice(1).filter((p) => p.valor > 0);
  assert.deepEqual(contasDoContrato(ACORDADA), fonte.map((p) => ({ rotulo: p.rotulo, valor: `R$ ${p.valor.toLocaleString("pt-BR")}/mês` })));
  assert.deepEqual(contasDoContrato(ACORDADA), [{ rotulo: "Consumo estimado", valor: "R$ 300/mês" }]);
  // Condomínio e consumo, cada um na sua linha; parcela zero não entra.
  const duas = contasDoContrato({ ...ACORDADA, termos: { ...ACORDADA.termos, condominio: 450 } }).map((l) => l.rotulo);
  assert.deepEqual(duas, ["Condomínio", "Consumo estimado"]);
  assert.deepEqual(contasDoContrato(null), []);
  assert.deepEqual(contasDoContrato({ ...ACORDADA, termos: { ...ACORDADA.termos, consumo: 0 } }), []);
});

test("E1085 — o quadro do contrato traz as contas logo depois do valor mensal; sem contas, o quadro de antes", () => {
  const contas = contasDoContrato(ACORDADA);
  const l = linhasContrato({ imovel: IM, inicio: "2027-01-10", fim: "2027-02-08", meses: 1, valorMensal: 2500, dias: 30, contas, caucao: 1250 });
  const rotulos = l.map((x) => x.rotulo);
  assert.deepEqual(rotulos, ["Imóvel", "Período", "Valor mensal", "Consumo estimado", "Total do contrato", "Caução"]);
  assert.deepEqual(l.find((x) => x.rotulo === "Consumo estimado"), { rotulo: "Consumo estimado", valor: "R$ 300/mês" });
  const antes = linhasContrato({ imovel: IM, inicio: "2027-01-10", fim: "2027-02-08", meses: 1, valorMensal: 2500, dias: 30 });
  assert.deepEqual(antes.map((x) => x.rotulo), ["Imóvel", "Período", "Valor mensal", "Total do contrato"]);
});

test("E1085 — os três e-mails passam as contas da mesma proposta acordada que dá o total", () => {
  const geracao = ler("src/lib/data/actions.ts");
  assert.match(geracao, /contaTotal: contaDoContrato\(acordada\),\s*contas: contasDoContrato\(acordada\),/);
  // "Falta a sua assinatura" e "contrato assinado" usam o mesmo quadro (quadro → corpo(outroId) e corpo(user.id)).
  const assinatura = ler("src/lib/data/contrato-assinar-actions.ts");
  assert.match(assinatura, /contaTotal: contaDoContrato\(acordadaDoContrato\),\s*contas: contasDoContrato\(acordadaDoContrato\),/);
});
