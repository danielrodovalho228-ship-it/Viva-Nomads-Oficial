import test from "node:test";
import assert from "node:assert/strict";
import { eventosDoContrato, conteudoPacoteProvas, nomeArquivoProvas, type DadosProvas } from "./contrato-provas.ts";
import { hashResumo } from "./contrato-assinar.ts";

const resumo = ["MINUTA DE TESTE — sem validade", "Contrato 11111111-2222-3333-4444-555555555555", "Imóvel: Studio Centro", "Valor mensal: R$ 2.500,00"];
const hash = hashResumo(resumo);

const dados: DadosProvas = {
  contratoId: "11111111-2222-3333-4444-555555555555",
  imovel: "Studio Centro",
  status: "ativo",
  registradoEm: "2026-10-01T12:00:00Z",
  resumo,
  assinaturas: [
    { papel: "inquilino", em: "2026-10-03T15:30:00Z", hash },
    { papel: "proprietario", em: "2026-10-02T13:00:00Z", hash },
  ],
  pagamentos: [
    { tipo: "caucao", valor: 1250, forma: "pix", dia: "2026-10-04", confirmadoEm: "2026-10-05T10:00:00Z" },
    { tipo: "aluguel", valor: 2500, forma: "pix", dia: "2026-10-04", confirmadoEm: null },
  ],
  conferencias: [
    {
      tipo: "entrada",
      abertaEm: "2026-10-06T09:00:00Z",
      itensPorParte: { proprietario: 2, inquilino: 1 },
      respostas: [{ parte: "inquilino", decisao: "contestou", em: "2026-10-07T09:00:00Z" }],
    },
  ],
};

test("eventos saem em ordem cronológica, do registro à conferência", () => {
  const ev = eventosDoContrato(dados);
  const tempos = ev.map((e) => e.em);
  assert.deepEqual([...tempos].sort(), tempos);
  assert.match(ev[0].texto, /registrado/i);
  assert.ok(ev.some((e) => /proprietário assinou/i.test(e.texto)));
  assert.ok(ev.some((e) => /Caução.*R\$\s?1\.250,00.*confirmado pelo inquilino/i.test(e.texto)));
  assert.ok(ev.some((e) => /Aluguel.*aguardando confirmação do inquilino/i.test(e.texto)));
  assert.match(ev.at(-1)!.texto, /inquilino contestou a conferência de entrada/i);
});

test("pagamento sem confirmação do inquilino não é dado como confirmado", () => {
  const ev = eventosDoContrato(dados).filter((e) => /Aluguel/.test(e.texto));
  assert.equal(ev.length, 1);
  assert.doesNotMatch(ev[0].texto, /confirmado pelo inquilino/);
});

test("pacote: marca de minuta, hash do resumo e conferência do hash de cada assinatura", () => {
  const c = conteudoPacoteProvas(dados);
  const texto = JSON.stringify(c);
  assert.match(texto, /MINUTA DE TESTE/);
  assert.ok(texto.includes(hash));
  assert.match(texto, /igual ao resumo atual/);
  const alterado = conteudoPacoteProvas({ ...dados, resumo: [...resumo, "Valor mensal: R$ 9.999,00"] });
  assert.match(JSON.stringify(alterado), /diferente do resumo atual/);
});

test("pacote não leva IP, e-mail, telefone nem documento; fala que não toca em dinheiro", () => {
  const texto = JSON.stringify(conteudoPacoteProvas(dados));
  assert.doesNotMatch(texto, /@|\bIP\b|CPF|telefone/i);
  assert.match(texto, /não recebe aluguel nem caução/i);
});

test("conferência sem resposta aparece como em andamento", () => {
  const ev = eventosDoContrato({ ...dados, conferencias: [{ ...dados.conferencias[0], respostas: [] }] });
  assert.ok(ev.some((e) => /conferência de entrada aberta/i.test(e.texto)));
});

test("nome do arquivo: só o início do número do contrato", () => {
  assert.equal(nomeArquivoProvas(dados.contratoId), "provas-contrato-11111111.pdf");
});
