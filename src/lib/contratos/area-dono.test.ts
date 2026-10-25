/*
  PROP-5 — área Contratos do dono sem repetição.
  Roda: node --test src/lib/contratos/area-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoCaucao } from "../caucao-estado.ts";
import { DEVOLUCAO_AO_FIM, contratoComConferenciaPendente, linhasCaucaoPorBloco, type ContratoParaCaucao } from "./area-dono.ts";

const bloco = (n: number, caucao: number, caucaoStatus = "pendente", caucaoForma = "avista") => ({ id: `b${n}`, numeroBloco: n, caucao, caucaoForma, caucaoStatus });
function contrato(id: string, blocos: ContratoParaCaucao["blocos"], extra: Partial<ContratoParaCaucao> = {}): ContratoParaCaucao {
  const pagamentos = extra.pagamentos ?? [];
  return { id, propertyTitle: `Imóvel ${id}`, blocos, pagamentos, caucao: estadoCaucao({ blocos, pagamentos }), ...extra };
}

test("Caução: uma linha por bloco com valor, forma, status, devolução e o link do contrato", () => {
  const l = linhasCaucaoPorBloco([contrato("c1", [bloco(2, 1600), bloco(1, 1600, "comprovada", "preauth_cartao")])]);
  assert.deepEqual(
    l.map((x) => [x.bloco, x.valor, x.forma, x.status, x.devolucao, x.href]),
    [
      [1, 1600, "Pré-autorização no cartão", "Recebida (em custódia do proprietário)", DEVOLUCAO_AO_FIM, "/dashboard/contratos/c1"],
      [2, 1600, "À vista", "A receber", DEVOLUCAO_AO_FIM, "/dashboard/contratos/c1"],
    ]
  );
  assert.equal(l[1].pendente, true);
});

test("Caução: o recebimento registrado no contrato vale para o bloco; a devolução vem do acerto", () => {
  const pag = [{ tipo: "caucao", valor: 1600, confirmado: false }];
  const [a] = linhasCaucaoPorBloco([contrato("c2", [bloco(1, 1600)], { pagamentos: pag })]);
  assert.equal(a.chaveStatus, "aguardando_confirmacao");
  const devolvida = contrato("c3", [bloco(1, 1600, "comprovada")]);
  devolvida.caucao = estadoCaucao({ blocos: devolvida.blocos, pagamentos: [], acerto: { status: "devolvida_integral" } });
  assert.equal(linhasCaucaoPorBloco([devolvida])[0].devolucao, "Devolvida");
});

test("Caução: contrato sem caução ou com seguro-fiança não vira linha; bloco sem caução também não", () => {
  const seguro = contrato("s", [bloco(1, 1600)]);
  seguro.caucao = estadoCaucao({ garantia: "seguro_fianca", blocos: seguro.blocos, pagamentos: [] });
  assert.deepEqual(linhasCaucaoPorBloco([seguro, contrato("z", [bloco(1, 0)]), contrato("m", [bloco(1, 900), bloco(2, 0)])]).map((x) => x.chave), ["m-b1"]);
});

test("#conferencia abre o primeiro contrato assinado e em andamento com a conferência de entrada pendente", () => {
  const cs = [
    { id: "a", status: "ativo", etapa: "aguardando_assinatura" },
    { id: "b", status: "concluido", etapa: "em_vigencia" },
    { id: "c", status: "ativo", etapa: "em_vigencia" },
    { id: "d", status: "ativo", etapa: "aguardando_pagamento" },
  ];
  assert.equal(contratoComConferenciaPendente(cs, new Map([["c", "confirmada"]])), "d");
  assert.equal(contratoComConferenciaPendente(cs, new Map([["c", "aguardando_outra_parte"]])), "c");
  assert.equal(contratoComConferenciaPendente(cs, new Map([["c", "contestada"], ["d", "confirmada"]])), null);
});

test("telas: Caução e Recibos não repetem o cartão do contrato e cada linha tem 'Ver contrato'; a conferência mora no detalhe", () => {
  const ler = (p: string) => readFileSync(p, "utf8");
  const caucao = ler("src/app/(dashboard)/dashboard/garantias/garantias-client.tsx");
  assert.match(caucao, /linhasCaucaoPorBloco/);
  assert.doesNotMatch(caucao, /ContratoCard/);
  assert.match(caucao, /ROTULO_VER_CONTRATO/);
  const recibos = ler("src/app/(dashboard)/dashboard/recibos/page.tsx");
  assert.match(recibos, /hrefContratoDono\(r\.contratoId\)/);
  const detalhe = ler("src/components/contrato/contrato-detalhe.tsx");
  assert.match(detalhe, /id="conferencia"/);
  assert.match(detalhe, /<LinhaDoTempoEstadia etapas=\{c\.linhaDoTempo\} hrefConferencia=/);
  const lista = ler("src/app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(lista, /conferenciaPendente/);
});
