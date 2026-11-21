/*
  E1074 (desdobramento do E1069; ORDEM-DUET-348) — a seção PAGAMENTOS do pacote de provas trazia só os totais:
  "Confirmados pelo inquilino: R$ 7.500,00. Aguardando confirmação do inquilino: R$ 0,00.". Nenhum documento era
  nomeado e a caução ia somada ao aluguel, sem linha.
  Depois: cada pagamento válido tem a sua linha, com o valor; a caução tem linha própria; o recibo (REC-…) e o comprovante da
  caução (CAU-…) aparecem pelo número, cada um na linha do pagamento a que pertence. Não se inventa número: pagamento
  sem documento emitido diz que ele ainda não foi emitido; documento anulado não é citado como válido.
  A trava de tela é a t2211 (Pista 3). Roda: node --test src/lib/e1074-pacote-recibos-e-caucao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COLUNAS_PROVAS, conteudoPacoteProvas, linhasPagamentos, montarDadosProvas, type DadosProvas, type LinhasProvas } from "./contrato-provas.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const base: LinhasProvas = {
  contratoId: "11111111-2222-3333-4444-555555555555",
  imovel: "Studio dos recibos",
  situacao: "Em vigência",
  registradoEm: "2026-11-20T18:00:00Z",
  resumo: ["Valor mensal: R$ 3.000,00"],
  prazoEntradaEm: null,
  assinaturas: [],
  pagamentos: [
    { id: "p-aluguel", tipo: "aluguel", valor: "6000.00", forma: "pix", data_pagamento: "2026-11-21", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-21T13:05:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-21T13:00:00Z" },
    { id: "p-caucao", tipo: "caucao", valor: "1500.00", forma: "pix", data_pagamento: "2026-11-21", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-21T13:06:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-21T13:01:00Z" },
  ],
  documentos: [
    { tipo: "recibo_aluguel", numero: "REC-2026-000001", pagamento_id: "p-aluguel", anulado_em: null },
    { tipo: "comprovante_caucao", numero: "CAU-2026-000001", pagamento_id: "p-caucao", anulado_em: null },
  ],
  conferencias: [],
  itens: [],
  respostas: [],
  laudos: [],
};
const secao = (d: DadosProvas) => {
  const corpo = conteudoPacoteProvas(d).corpo;
  return corpo.slice(corpo.indexOf("PAGAMENTOS") + 1, corpo.indexOf("CONFERÊNCIAS"));
};

test("cada pagamento tem a sua linha: o recibo e o comprovante pelo número, a caução com linha própria e o valor", () => {
  const linhas = secao(montarDadosProvas(base));
  assert.deepEqual(linhas, [
    "Confirmados pelo inquilino: R$ 7.500,00. Aguardando confirmação do inquilino: R$ 0,00.",
    "Aluguel de R$ 6.000,00 (Pix, em 21/11/2026): confirmado pelo inquilino em 21/11/2026 às 10:05. Recibo REC-2026-000001.",
    "Caução de R$ 1.500,00 (Pix, em 21/11/2026): confirmada pelo inquilino em 21/11/2026 às 10:06. Comprovante da caução CAU-2026-000001.",
  ]);
  // O que a t2211 cobra: os dois números na seção e a caução numa linha com o valor.
  const texto = linhas.join("\n");
  assert.ok(texto.includes("REC-2026-000001") && texto.includes("CAU-2026-000001"));
  assert.match(texto, /Cau[cç][aã]o[^\n]*R\$ 1\.500,00/);
});

test("pagamento ainda não confirmado: a linha diz que aguarda, sem documento", () => {
  const d = montarDadosProvas({
    ...base,
    pagamentos: [{ ...base.pagamentos[1], confirmado_pelo_inquilino: false, confirmado_em: null }],
    documentos: [],
  });
  assert.deepEqual(linhasPagamentos(d.pagamentos), ["Caução de R$ 1.500,00 (Pix, em 21/11/2026): aguardando confirmação do inquilino."]);
});

test("confirmado e ainda sem documento emitido: não se inventa número", () => {
  const d = montarDadosProvas({ ...base, documentos: [] });
  assert.deepEqual(linhasPagamentos(d.pagamentos), [
    "Aluguel de R$ 6.000,00 (Pix, em 21/11/2026): confirmado pelo inquilino em 21/11/2026 às 10:05. Recibo ainda não emitido.",
    "Caução de R$ 1.500,00 (Pix, em 21/11/2026): confirmada pelo inquilino em 21/11/2026 às 10:06. Comprovante da caução ainda não emitido.",
  ]);
});

test("documento anulado não é citado; documento de outro tipo ou de outro pagamento não entra na linha", () => {
  const d = montarDadosProvas({
    ...base,
    documentos: [
      { tipo: "recibo_aluguel", numero: "REC-2026-000009", pagamento_id: "p-aluguel", anulado_em: "2026-11-21T14:00:00Z" },
      { tipo: "termo_devolucao_caucao", numero: "DEV-2026-000001", pagamento_id: "p-caucao", anulado_em: null },
      { tipo: "recibo_aluguel", numero: "REC-2026-000777", pagamento_id: "outro", anulado_em: null },
    ],
  });
  const texto = linhasPagamentos(d.pagamentos).join("\n");
  assert.doesNotMatch(texto, /REC-2026-000009|DEV-2026-000001|REC-2026-000777/);
  assert.match(texto, /Recibo ainda não emitido\./);
});

test("registro anulado: sem linha na seção e sem documento; a marca aparece UMA vez no pacote (linha do tempo), como antes", () => {
  const d = montarDadosProvas({
    ...base,
    pagamentos: [{ ...base.pagamentos[1], confirmado_pelo_inquilino: false, confirmado_em: null, anulado_em: "2026-11-21T15:00:00Z", anulado_motivo: "registro em duplicidade" }, base.pagamentos[0]],
  });
  const linhas = secao(d);
  assert.equal(linhas[0], "Confirmados pelo inquilino: R$ 6.000,00. Aguardando confirmação do inquilino: R$ 0,00.");
  assert.equal(linhas[1], "1 registro anulado fica fora dos totais.");
  assert.deepEqual(linhas.slice(2), ["Aluguel de R$ 6.000,00 (Pix, em 21/11/2026): confirmado pelo inquilino em 21/11/2026 às 10:05. Recibo REC-2026-000001."]);
  const pacote = conteudoPacoteProvas(d).corpo.join("\n");
  assert.ok(!pacote.includes("CAU-2026-000001"));
  assert.equal(pacote.split("registro anulado em").length - 1, 1);
});

test("sem pagamento nenhum, a seção continua a dizer que não há", () => {
  assert.deepEqual(secao(montarDadosProvas({ ...base, pagamentos: [], documentos: [] })), ["Nenhum pagamento marcado."]);
});

test("as duas cargas (partes e equipe) leem o id do pagamento e os documentos do contrato", () => {
  assert.match(COLUNAS_PROVAS.pagamentos, /\bid\b/);
  assert.equal(COLUNAS_PROVAS.documentos, "tipo, numero, pagamento_id, anulado_em");
  for (const arquivo of ["src/lib/data/contrato-provas.ts", "src/lib/data/contrato-admin.ts"]) {
    const fonte = ler(arquivo);
    assert.match(fonte, /from\("documentos_fiscais"\)\s*\.select\(COLUNAS_PROVAS\.documentos\)/, arquivo);
    assert.match(fonte, /documentos:\s*docs \?\? \[\]/, arquivo);
  }
});
