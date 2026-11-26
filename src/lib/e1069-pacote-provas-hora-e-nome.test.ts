/*
  E1069 — o Pacote de provas (PDF) trazia duas coisas erradas na prova ao vivo de 20/11:
   (a) a linha do tempo punha o pagamento marcado pelo proprietário sempre às 09:00 — o código carimbava o dia do
       pagamento ao meio-dia UTC (`${dia}T12:00:00Z`), que é 09:00 em Brasília, e escrevia essa hora inventada;
   (b) as assinaturas diziam só "O proprietário" / "O inquilino", sem o nome de quem assinou.
  Depois: a hora do pagamento na linha do tempo é a do REGISTRO (created_at de pagamentos_bloco); sem esse instante, a
  linha traz só o dia, sem hora inventada. As assinaturas (seção e linha do tempo, contrato e aditivo) trazem
  "Nome completo (papel)"; sem nome no perfil, continua "O proprietário" / "O inquilino".
  Roda: node --test src/lib/e1069-pacote-provas-hora-e-nome.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COLUNAS_PROVAS, conteudoPacoteProvas, eventosDoContrato, linhaDoEvento, montarDadosProvas, type DadosProvas, type LinhasProvas } from "./contrato-provas.ts";
import { hashResumo } from "./contrato-assinar.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const resumo = ["MINUTA DE TESTE — sem validade", "Imóvel: Studio Centro", "Valor mensal: R$ 2.500,00"];
const hash = hashResumo(resumo);
const NOMES = { proprietario: "Dora Souza Lima", inquilino: "Iris Prado Reis" };

const dados: DadosProvas = {
  contratoId: "11111111-2222-3333-4444-555555555555",
  imovel: "Studio Centro",
  situacao: "Em vigência",
  registradoEm: "2026-11-20T18:00:00Z",
  resumo,
  assinaturas: [
    { papel: "proprietario", em: "2026-11-20T21:40:00Z", hash },
    { papel: "inquilino", em: "2026-11-20T21:52:00Z", hash },
  ],
  pagamentos: [
    // Registrado às 22:20 UTC = 19:20 em Brasília; o dia declarado do pagamento é 20/11.
    { tipo: "aluguel", valor: 2583.33, forma: "pix", dia: "2026-11-20", registradoEm: "2026-11-20T22:20:00Z", confirmadoEm: "2026-11-20T22:31:00Z" },
  ],
  conferencias: [],
};
const linhaDoTempo = (d: DadosProvas) => {
  const corpo = conteudoPacoteProvas(d).corpo;
  return corpo.slice(corpo.indexOf("LINHA DO TEMPO") + 1);
};
const assinaturas = (d: DadosProvas) => {
  const corpo = conteudoPacoteProvas(d).corpo;
  return corpo.slice(corpo.indexOf("ASSINATURAS") + 1, corpo.indexOf("ADITIVOS"));
};

test("(a) o pagamento entra na linha do tempo na hora em que foi REGISTRADO, não às 09:00", () => {
  const linhas = linhaDoTempo(dados);
  const marcado = linhas.find((l) => /marcado como pago/.test(l));
  assert.equal(marcado, "20/11/2026 às 19:20 — Aluguel de R$ 2.583,33 marcado como pago pelo proprietário (Pix, em 20/11/2026).");
  assert.ok(!linhas.some((l) => /às 09:00/.test(l)), "nenhuma linha traz a hora inventada (09:00)");
  // A ordem segue os instantes reais: registro (19:20) antes da confirmação (19:31).
  const i = linhas.findIndex((l) => /marcado como pago/.test(l));
  const j = linhas.findIndex((l) => /confirmado pelo inquilino/.test(l));
  assert.ok(i >= 0 && j > i);
  assert.match(linhas[j], /^20\/11\/2026 às 19:31 — /);
});

test("(a) pagamento anulado: a linha também sai na hora do registro", () => {
  const d: DadosProvas = {
    ...dados,
    pagamentos: [{ tipo: "caucao", valor: 1292, forma: "pix", dia: "2026-11-20", registradoEm: "2026-11-20T22:25:00Z", confirmadoEm: null, anuladoEm: "2026-11-20T22:40:00Z", anuladoMotivo: "registro em duplicidade" }],
  };
  const linha = linhaDoTempo(d).find((l) => /Caução/.test(l));
  assert.equal(linha, "20/11/2026 às 19:25 — Caução de R$ 1.292,00 marcado como pago pelo proprietário (Pix, em 20/11/2026) — registro anulado em 20/11/2026 às 19:40 (registro em duplicidade).");
});

test("(a) sem o instante do registro, a linha traz só o dia — nunca uma hora inventada", () => {
  const d: DadosProvas = { ...dados, pagamentos: [{ tipo: "aluguel", valor: 2500, forma: "pix", dia: "2026-11-20", confirmadoEm: null }] };
  const ev = eventosDoContrato(d).find((e) => /marcado como pago/.test(e.texto))!;
  assert.equal(ev.soDia, true);
  assert.equal(linhaDoEvento(ev), "20/11/2026 — Aluguel de R$ 2.500,00 marcado como pago pelo proprietário (Pix, em 20/11/2026); aguardando confirmação do inquilino.");
  assert.ok(!linhaDoTempo(d).some((l) => /às 09:00/.test(l)));
});

test("(a) a carga lê o instante do registro (created_at) e a montagem leva-o ao pacote", () => {
  assert.match(COLUNAS_PROVAS.pagamentos, /\bcreated_at\b/);
  const linhas: LinhasProvas = {
    contratoId: dados.contratoId,
    imovel: dados.imovel,
    situacao: dados.situacao,
    registradoEm: dados.registradoEm,
    resumo,
    prazoEntradaEm: null,
    assinaturas: [],
    pagamentos: [{ tipo: "aluguel", valor: "2583.33", forma: "pix", data_pagamento: "2026-11-20", confirmado_pelo_inquilino: false, confirmado_em: null, anulado_em: null, anulado_motivo: null, created_at: "2026-11-20T22:20:00.123456+00:00" }],
    conferencias: [],
    itens: [],
    respostas: [],
    laudos: [],
  };
  const d = montarDadosProvas(linhas);
  assert.equal(d.pagamentos[0].registradoEm, "2026-11-20T22:20:00.123456+00:00");
  assert.match(linhaDoTempo(d).find((l) => /marcado como pago/.test(l))!, /^20\/11\/2026 às 19:20 — /);
});

test("(b) as assinaturas trazem o nome de quem assinou, na seção e na linha do tempo", () => {
  const d: DadosProvas = { ...dados, nomes: NOMES };
  const secao = assinaturas(d);
  assert.match(secao[0], /^Dora Souza Lima \(proprietário\) em 20\/11\/2026 às 18:40 — Hash do resumo assinado: /);
  assert.match(secao[1], /^Iris Prado Reis \(inquilino\) em 20\/11\/2026 às 18:52 — Hash do resumo assinado: /);
  const linhas = linhaDoTempo(d);
  assert.ok(linhas.includes("20/11/2026 às 18:40 — Dora Souza Lima (proprietário) assinou o resumo do contrato."));
  assert.ok(linhas.includes("20/11/2026 às 18:52 — Iris Prado Reis (inquilino) assinou o resumo do contrato."));
});

test("(b) data de assinatura sem registro com hash (E197) e assinatura de aditivo também trazem o nome", () => {
  const d: DadosProvas = {
    ...dados,
    nomes: NOMES,
    assinaturas: [],
    assinaturasSemHash: [{ papel: "inquilino", em: "2026-11-20T21:52:00Z" }],
    aditivos: [{ numero: 1, resumo: "Meses: de 1 para 2", status: "assinado", propostoEm: "2026-11-21T10:00:00Z", assinadoEm: "2026-11-21T12:00:00Z", hash: "abc123", assinaturas: [{ papel: "proprietario", em: "2026-11-21T12:00:00Z", hash: "abc123" }] }],
  };
  const corpo = conteudoPacoteProvas(d).corpo;
  assert.ok(corpo.includes("Iris Prado Reis (inquilino) em 20/11/2026 às 18:52 — data gravada no contrato, sem o registro do hash do resumo assinado."));
  assert.ok(corpo.includes("Dora Souza Lima (proprietário) assinou o aditivo 1 em 21/11/2026 às 09:00."));
});

test("(b) sem nome no perfil, o pacote continua a dizer o papel — não inventa nome", () => {
  for (const d of [dados, { ...dados, nomes: { proprietario: null, inquilino: "  " } }] as DadosProvas[]) {
    const secao = assinaturas(d);
    assert.match(secao[0], /^O proprietário em 20\/11\/2026 às 18:40 — /);
    assert.match(secao[1], /^O inquilino em 20\/11\/2026 às 18:52 — /);
    assert.ok(linhaDoTempo(d).includes("20/11/2026 às 18:40 — O proprietário assinou o resumo do contrato."));
  }
});

test("(b) o gerador do PDF registrado lê o nome completo das duas partes (as duas rotas passam por ele)", () => {
  const gerador = ler("src/lib/fiscal/pacote-provas.ts");
  assert.match(gerador, /from\("profiles"\)\s*\.select\("id, full_name"\)/);
  assert.match(gerador, /nomeCompleto\(/);
  assert.match(gerador, /nomes:\s*\{/);
  // Leitura que falha não vira pacote sem nome (achado 77): lança, e a rota responde 503.
  assert.match(gerador, /throw new Error\("Não foi possível ler os nomes das partes/);
  // O pacote continua sem contato nem documento: só o nome.
  const texto = JSON.stringify(conteudoPacoteProvas({ ...dados, nomes: NOMES }));
  assert.doesNotMatch(texto, /@|\bIP\b|CPF|telefone/i);
});
