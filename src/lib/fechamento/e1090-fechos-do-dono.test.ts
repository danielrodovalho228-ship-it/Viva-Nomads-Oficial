/*
  E1090 — o Fechamento mostra todos os fechos do dono (ESPEC-E1090, fechada na ORDEM-DUET-610/611).
  Antes: a página abria só a candidatura aceita mais recente (`limit(1)`), sem lista nem forma de trocar; o fecho de
  qualquer outra candidatura ficava fora do alcance de quem entra pelo menu, e a pré-aceitação expirada da mais recente
  escondia as outras atrás de "Nenhuma candidatura aceita ainda".
  Depois: uma regra pura (`fechosDoDono`) monta as linhas (estadia com proposta, contrato sem proposta, candidatura por
  fechar), liga cada contrato pela candidatura E pela proposta, tira o estado do CONTRATO (R3a, nunca do rótulo da
  proposta), ordena pelo que espera o dono e diz qual candidatura a página abre.
  Roda: node --test src/lib/fechamento/e1090-fechos-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { fechosDoDono, TETO_FECHOS, type CandidaturaDoFecho, type ContratoDoFecho, type PropostaDoFecho } from "./fechos-do-dono.ts";

const DONO = "dono-1";
const ASSINANDO = { selo: "Aguardando assinatura", etapa: "aguardando_assinatura" };
const ASSINADO = { selo: "Em vigência", etapa: "em_vigencia" };

function cand(id: string, aceitaEm: string, extra: Partial<CandidaturaDoFecho> = {}): CandidaturaDoFecho {
  return { id, donoId: DONO, imovel: `Imóvel ${id}`, morador: `Morador ${id}`, aceitaEm, preAceiteExpirado: false, periodo: null, ...extra };
}
function prop(id: string, leadId: string, aceitaEm: string, status = "aceita"): PropostaDoFecho {
  return { id, leadId, numero: `ORC-${id}`, status, aceitaEm, periodo: { inicio: "2026-12-01", fim: "2027-01-29" } };
}
function contr(id: string, leadId: string, propostaId: string | null, criadoEm: string, estado = ASSINADO): ContratoDoFecho {
  return { id, leadId, propostaId, criadoEm, periodo: null, estado };
}

test("duas candidaturas aceitas → duas linhas (a lista não fica só com a primeira)", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("a", "2026-11-10T10:00:00Z"), cand("b", "2026-11-20T10:00:00Z")],
    propostas: [prop("pb", "b", "2026-11-20T10:00:00Z")],
    contratos: [contr("c0000000-0000-0000-0000-00000000000a", "a", null, "2026-11-11T10:00:00Z"), contr("c0000000-0000-0000-0000-00000000000b", "b", "pb", "2026-11-21T10:00:00Z")],
  });
  assert.equal(r.linhas.length, 2);
  assert.deepEqual(new Set(r.linhas.map((l) => l.leadId)), new Set(["a", "b"]));
  // Cada linha com o número do SEU contrato.
  assert.equal(r.linhas.find((l) => l.leadId === "a")?.contrato, "VN-CT-C0000000 · id …000a");
  assert.equal(r.linhas.find((l) => l.leadId === "b")?.contrato, "VN-CT-C0000000 · id …000b");
});

test("uma candidatura, duas propostas acordadas, dois contratos → duas linhas, cada contrato na sua", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("a", "2026-11-01T10:00:00Z")],
    propostas: [prop("p1", "a", "2026-11-02T10:00:00Z", "contrato_assinado"), prop("p2", "a", "2026-11-15T10:00:00Z", "em_contrato")],
    contratos: [contr("11111111-0000-0000-0000-000000000001", "a", "p1", "2026-11-03T10:00:00Z"), contr("22222222-0000-0000-0000-000000000002", "a", "p2", "2026-11-16T10:00:00Z", ASSINANDO)],
  });
  assert.equal(r.linhas.length, 2);
  assert.equal(r.linhas.find((l) => l.propostaId === "p1")?.contratoId, "11111111-0000-0000-0000-000000000001");
  assert.equal(r.linhas.find((l) => l.propostaId === "p2")?.contratoId, "22222222-0000-0000-0000-000000000002");
});

test("contrato sem proposta + proposta nova aceita → linha B própria; a proposta nova fica 'Por gerar' e vem primeiro", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("a", "2026-11-01T10:00:00Z")],
    propostas: [prop("p2", "a", "2026-11-15T10:00:00Z")],
    contratos: [contr("33333333-0000-0000-0000-000000000003", "a", null, "2026-11-02T10:00:00Z")],
  });
  assert.equal(r.linhas.length, 2);
  const [primeira, segunda] = r.linhas;
  assert.equal(primeira.tipo, "A");
  assert.equal(primeira.propostaId, "p2");
  assert.equal(primeira.contratoId, null, "o contrato antigo não é dado à proposta nova");
  assert.equal(primeira.estado, "Por gerar");
  assert.equal(segunda.tipo, "B");
  assert.equal(segunda.contratoId, "33333333-0000-0000-0000-000000000003");
});

test("candidatura aceita sem proposta nem contrato → linha C, que abre o assistente", () => {
  const r = fechosDoDono({ donoId: DONO, candidaturas: [cand("a", "2026-11-01T10:00:00Z")], propostas: [], contratos: [] });
  assert.equal(r.linhas.length, 1);
  assert.equal(r.linhas[0].tipo, "C");
  assert.equal(r.linhas[0].estado, "Por gerar");
  assert.deepEqual(r.linhas[0].acao, { tipo: "assistente", href: "/dashboard/fechamento?c=a" });
  assert.equal(r.abrir, "a");
});

test("caso 13 (R3a): proposta 'em contrato' SEM linha em contratos → 'Por gerar', sem número de contrato", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("e7b1f322", "2026-11-21T10:00:00Z")],
    propostas: [prop("orc15", "e7b1f322", "2026-11-21T10:00:00Z", "em_contrato"), prop("orc19", "e7b1f322", "2026-11-22T10:00:00Z", "contrato_assinado")],
    contratos: [contr("2384e69d-0000-0000-0000-000000000019", "e7b1f322", "orc19", "2026-11-22T12:00:00Z")],
  });
  assert.equal(r.linhas.length, 2);
  const [primeira, segunda] = r.linhas;
  assert.equal(primeira.propostaId, "orc15", "a mais antiga, por gerar, vem primeiro");
  assert.equal(primeira.estado, "Por gerar", "o rótulo 'em contrato' da proposta não vira estado");
  assert.equal(primeira.contrato, null);
  assert.equal(primeira.contratoId, null);
  assert.equal(primeira.acao.tipo, "assistente", "E1141: a estadia anterior sem contrato abre o assistente dela");
  assert.equal(primeira.acao.href, "/dashboard/fechamento?c=e7b1f322&p=orc15");
  assert.equal(segunda.propostaId, "orc19");
  assert.equal(segunda.contrato, "VN-CT-2384E69D", "o contrato fica só na mais nova");
  assert.equal(segunda.estado, "Em vigência");
  assert.equal(r.abrir, "e7b1f322");
});

test("pré-aceitação expirada: sem contrato → sem linha; com contrato → só a linha do contrato", () => {
  const sem = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("a", "2026-11-01T10:00:00Z", { preAceiteExpirado: true })],
    propostas: [prop("p1", "a", "2026-11-02T10:00:00Z")],
    contratos: [],
  });
  assert.equal(sem.linhas.length, 0);
  assert.equal(sem.abrir, null);
  const com = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("a", "2026-11-01T10:00:00Z", { preAceiteExpirado: true })],
    propostas: [prop("p1", "a", "2026-10-02T10:00:00Z", "contrato_assinado"), prop("p2", "a", "2026-11-02T10:00:00Z")],
    contratos: [contr("44444444-0000-0000-0000-000000000004", "a", "p1", "2026-10-03T10:00:00Z")],
  });
  assert.equal(com.linhas.length, 1);
  assert.equal(com.linhas[0].contratoId, "44444444-0000-0000-0000-000000000004");
  assert.notEqual(com.linhas[0].acao.tipo, "assistente", "a candidatura expirada não abre o assistente");
});

test("a expirada mais recente não esconde a válida: a página abre a válida", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("valida", "2026-11-01T10:00:00Z"), cand("expirada", "2026-11-20T10:00:00Z", { preAceiteExpirado: true })],
    propostas: [prop("pe", "expirada", "2026-11-20T10:00:00Z")],
    contratos: [],
  });
  assert.deepEqual(r.linhas.map((l) => l.leadId), ["valida"]);
  assert.equal(r.abrir, "valida");
});

test("a ordem: por gerar, à espera de assinatura, o resto; mais recente primeiro em cada grupo", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [
      cand("g1-velha", "2026-11-01T10:00:00Z"),
      cand("g1-nova", "2026-11-05T10:00:00Z"),
      cand("g2-velha", "2026-11-02T10:00:00Z"),
      cand("g2-nova", "2026-11-03T10:00:00Z"),
      cand("g3-velha", "2026-11-04T10:00:00Z"),
      cand("g3-nova", "2026-11-06T10:00:00Z"),
    ],
    propostas: [],
    contratos: [
      contr("aaaaaaa1-0000-0000-0000-000000000001", "g2-velha", null, "2026-11-02T12:00:00Z", ASSINANDO),
      contr("aaaaaaa2-0000-0000-0000-000000000002", "g2-nova", null, "2026-11-03T12:00:00Z", ASSINANDO),
      contr("aaaaaaa3-0000-0000-0000-000000000003", "g3-velha", null, "2026-11-04T12:00:00Z"),
      contr("aaaaaaa4-0000-0000-0000-000000000004", "g3-nova", null, "2026-11-06T12:00:00Z"),
    ],
  });
  assert.deepEqual(r.linhas.map((l) => l.leadId), ["g1-nova", "g1-velha", "g2-nova", "g2-velha", "g3-nova", "g3-velha"]);
});

test("a página abre a primeira da ordem, não a aceita mais recente", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("por-gerar", "2026-11-01T10:00:00Z"), cand("assinada", "2026-11-20T10:00:00Z")],
    propostas: [],
    contratos: [contr("bbbbbbbb-0000-0000-0000-000000000001", "assinada", null, "2026-11-21T10:00:00Z")],
  });
  assert.equal(r.linhas[0].leadId, "por-gerar");
  assert.equal(r.abrir, "por-gerar");
});

test("candidatura de outro dono nos dados de entrada → fora, com as propostas e os contratos dela", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("minha", "2026-11-01T10:00:00Z"), cand("alheia", "2026-11-20T10:00:00Z", { donoId: "outro" })],
    propostas: [prop("pa", "alheia", "2026-11-20T10:00:00Z")],
    contratos: [contr("cccccccc-0000-0000-0000-000000000001", "alheia", "pa", "2026-11-21T10:00:00Z")],
  });
  assert.deepEqual(r.linhas.map((l) => l.leadId), ["minha"]);
});

test(`teto: ${TETO_FECHOS + 1} linhas → ${TETO_FECHOS} e a contagem do que ficou de fora`, () => {
  const candidaturas = Array.from({ length: TETO_FECHOS + 1 }, (_, i) => cand(`l${i}`, new Date(Date.UTC(2026, 9, 1) + i * 3_600_000).toISOString()));
  const r = fechosDoDono({ donoId: DONO, candidaturas, propostas: [], contratos: [] });
  assert.equal(TETO_FECHOS, 50);
  assert.equal(r.linhas.length, 50);
  assert.equal(r.foraDoTeto, 1);
});

test("cada linha diz o imóvel, o morador, o período e o orçamento — nenhum contato", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand("a", "2026-11-01T10:00:00Z")],
    propostas: [prop("p1", "a", "2026-11-02T10:00:00Z")],
    contratos: [],
  });
  const l = r.linhas[0];
  assert.equal(l.imovel, "Imóvel a");
  assert.equal(l.morador, "Morador a");
  assert.deepEqual(l.periodo, { inicio: "2026-12-01", fim: "2027-01-29" });
  assert.equal(l.orcamento, "ORC-p1");
  assert.deepEqual(Object.keys(l).filter((k) => /mail|telefone|fone|whats/i.test(k)), []);
});

/* ── A página e a leitura (lidas na fonte, como as outras travas da casa) ───────────────────────────────────────── */
import { readFileSync } from "node:fs";
const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("R5/R8/R9: a página lê todos os fechos; sem ?c= abre a primeira da ordem; ?c= alheio dá o aviso", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/fechamento/page.tsx");
  assert.match(pagina, /await lerFechosDoDono\(\)/, "a página lê a lista");
  assert.match(pagina, /getFechamentoContext\(lidos\.abrir\)/, "sem ?c=, abre a primeira linha da ordem");
  assert.doesNotMatch(pagina, /const realCtx = await getFechamentoContext\(c\);/, "não volta a abrir só a aceita mais recente");
  assert.match(pagina, /const naoEncontrado = Boolean\(c\) && !realCtx;/, "?c= que não abre nada → o aviso");
});

test("R10: a leitura dos fechos lança na falha — 'não li' nunca vira lista vazia", () => {
  const leitura = ler("src/lib/data/fechos-do-dono-servidor.ts");
  assert.match(leitura, /if \(erroLeads\) throw new Error\(MSG_FECHOS_SEM_LEITURA\)/);
  assert.match(leitura, /rPropostas\.error \|\| rContratos\.error/);
  assert.match(leitura, /if \(erroVersoes\) throw new Error\(MSG_FECHOS_SEM_LEITURA\)/);
  assert.match(leitura, /\.eq\("owner_id", user\.id\)/, "só as candidaturas do próprio dono");
});

test("R5/R11/caso 12: a lista só aparece com dois ou mais fechos (ou com o aviso); a demonstração fica sem lista", () => {
  const cliente = ler("src/app/(dashboard)/dashboard/fechamento/closing-client.tsx");
  assert.match(cliente, /fechos\.linhas\.length > 1 \|\| fechos\.naoEncontrado/);
  assert.match(cliente, /if \(demo\) return <ClosingFlow ctx=\{SAMPLE_CTX\} demo \/>;/, "a demonstração não muda");
  assert.match(cliente, /if \(fechos\?\.temAceitas\)/, "há aceitas, nenhuma por fechar → texto próprio, não 'nenhuma aceita'");
});
