/*
  E655 — o Fechamento transformava a JANELA EXATA da candidatura (10/01–24/02/2027 = 45 dias) em bloco de MESES INTEIROS
  (2 meses/60 dias, R$ 5.600): sem proposta ligada à candidatura, abria com os meses arredondados para cima. Agora, sem
  proposta, o Fechamento (e o servidor, que confere) usa os DIAS EXATOS da candidatura — a menos que o dono escolha
  outros meses de propósito.
  Roda: node --test src/lib/e655-fechamento-dias-candidatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diasDaCandidaturaParaContrato, prazoDoContratoEmDias } from "./contrato-prazo-dias.ts";
import { resumoContratoEmDias, encadearDatas } from "./contrato-blocos.ts";

const ok = (d: number) => Number.isInteger(d) && d >= 30 && d <= 180;

test("a janela 10/01–24/02/2027 vale 45 dias exatos quando o pedido confere", () => {
  assert.equal(diasDaCandidaturaParaContrato({ inicio: "2027-01-10", fim: "2027-02-24", diasPedidos: 45, valido: ok }), 45);
});

test("o servidor não confia no navegador: dias diferentes da janela, ou fora da faixa, não valem", () => {
  assert.equal(diasDaCandidaturaParaContrato({ inicio: "2027-01-10", fim: "2027-02-24", diasPedidos: 60, valido: ok }), null);
  assert.equal(diasDaCandidaturaParaContrato({ inicio: "2027-01-10", fim: "2027-01-20", diasPedidos: 10, valido: ok }), null);
  assert.equal(diasDaCandidaturaParaContrato({ inicio: null, fim: "2027-02-24", diasPedidos: 45, valido: ok }), null);
  assert.equal(diasDaCandidaturaParaContrato({ inicio: "2027-01-10", fim: "2027-02-24", diasPedidos: null, valido: ok }), null);
});

test("o contrato dessa janela sai com 45 dias, um bloco e fim em 23/02 — não 60 dias até 10/03", () => {
  const r = resumoContratoEmDias(45, 2800, 0.1, 3);
  assert.equal(r.prazoTotalDias, 45);
  const b = encadearDatas("2027-01-10", r.blocos);
  assert.equal(b.length, 1);
  assert.equal(b[0].fim, "2027-02-23");
  const doc = prazoDoContratoEmDias({ diasAcordados: 45, mesesDoFechamento: 2 });
  assert.equal(doc.dias, 45);
});

test("a tela e o servidor usam os dias da candidatura", () => {
  const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  assert.match(ler("lib/data/leads-actions.ts"), /diasSugerido/);
  const tela = ler("app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(tela, /DIAS_CANDIDATURA/);
  assert.match(tela, /prazoTotalDias: DIAS_CANDIDATURA/);
  assert.match(tela, /termDays: DIAS_CANDIDATURA/);
  assert.match(ler("lib/data/actions.ts"), /diasDaCandidaturaParaContrato\(/);
  assert.match(ler("app/api/contrato/route.ts"), /diasDaCandidaturaParaContrato\(/);
});
