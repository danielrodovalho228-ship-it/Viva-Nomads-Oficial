/*
  E1066 (ORDEM-DUET-310/321): os e-mails do contrato.
   1. a linha da caução entra no quadro (geração e assinatura), com o valor dos blocos do contrato (a mesma fonte do
      painel "Valores" da estadia); seguro-fiança (caução 0) fica sem a linha;
   2. o e-mail de geração vai também ao dono (antes só o morador recebia);
   3. "Total do contrato" é a conta da fonte única (precoDaProposta: mensal, contas e limpeza), não só o aluguel
      prorateado; sem proposta acordada, fica a conta de antes.
  Roda: node --test src/lib/notifications/e1066-emails-do-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhasContrato, contaDoContrato } from "./dados-negociacao.ts";
import { precoDaProposta } from "../precos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const IM = { id: "x", titulo: "Apto Centro", bairro: "Centro", cidade: "Uberlândia" };

// O contrato D2BD66E0 da prova: R$ 2.500/mês, 31 dias, caução R$ 1.292, com contas e limpeza na proposta.
const ACORDADA = {
  valorMensal: 2500,
  meses: 2,
  termos: { condominio: 300, consumo: 150, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, limpezaUnica: 150, dias: 31, limpezasPacote: null },
};

test("E1066 — contaDoContrato é a conta da fonte única (precoDaProposta), com contas e limpeza", () => {
  const esperado = precoDaProposta({ ...ACORDADA.termos, valorMensal: 2500, meses: 2 }).conta;
  assert.ok(esperado && /prepara/i.test(esperado), "a conta da fonte única traz a limpeza de preparação");
  assert.equal(contaDoContrato(ACORDADA), esperado);
  assert.equal(contaDoContrato(null), null);
});

test("E1066 — o quadro traz a conta da fonte única e a linha da caução; sem caução, sem a linha", () => {
  const conta = contaDoContrato(ACORDADA) as string;
  const l = linhasContrato({ imovel: IM, inicio: "2027-01-10", fim: "2027-02-09", meses: 1, valorMensal: 2500, dias: 31, contaTotal: conta, caucao: 1292 });
  assert.deepEqual(l.find((x) => x.rotulo === "Total do contrato"), { rotulo: "Total do contrato", valor: conta });
  assert.deepEqual(l.find((x) => x.rotulo === "Caução"), { rotulo: "Caução", valor: "R$ 1.292" });
  assert.ok(l.findIndex((x) => x.rotulo === "Caução") > l.findIndex((x) => x.rotulo === "Total do contrato"));
  const fianca = linhasContrato({ imovel: IM, inicio: "2027-01-10", fim: "2027-02-09", meses: 1, valorMensal: 2500, dias: 31, contaTotal: conta, caucao: 0 });
  assert.equal(fianca.find((x) => x.rotulo === "Caução"), undefined);
  // Sem proposta acordada: a conta de antes (só o aluguel), como estava.
  const antes = linhasContrato({ imovel: IM, inicio: "2027-01-10", fim: "2027-02-09", meses: 1, valorMensal: 2500, dias: 31 });
  assert.match(antes.find((x) => x.rotulo === "Total do contrato")!.valor, /R\$ 2\.500 × 31 dias ÷ 30 = R\$ 2\.583,33/);
});

test("E1066 — a geração usa a fonte única e a caução dos blocos, e avisa também o dono", () => {
  const a = ler("src/lib/data/actions.ts");
  const g = a.slice(a.indexOf("const contratoNovoId = contrato!.id as string;"), a.indexOf('revalidatePath("/dashboard/contratos");', a.indexOf("const contratoNovoId")));
  assert.match(g, /contaTotal: contaDoContrato\(acordada\)/);
  assert.match(g, /caucao: rows\.reduce\(\(s, r\) => s \+ Number\(r\.caucao\), 0\)/);
  assert.match(g, /papelAviso: "morador"/);
  assert.match(g, /papelAviso: "dono"/);
  assert.match(g, /subject: ASSUNTOS\.contratoPronto/);
  assert.equal((g.match(/\.\.\.quadro,/g) ?? []).length, 2, "o e-mail de geração sai para o morador E para o dono, com o mesmo quadro");
});

test("E1066 — a assinatura lê a mesma conta e a mesma caução", () => {
  const s = ler("src/lib/data/contrato-assinar-actions.ts");
  assert.match(s, /contaTotal: contaDoContrato\(acordadaDoContrato\)/);
  assert.match(s, /caucao: caucaoDoContrato/);
});
