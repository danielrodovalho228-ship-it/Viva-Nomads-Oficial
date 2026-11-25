/*
  E1141 — abrir o assistente de fecho de uma estadia ANTERIOR da mesma candidatura (2.ª fatia da ESPEC-E1090; âmbito
  julgado na ORDEM-DUET-929).
  Antes: o assistente e tudo o que ele dispara (os valores, o contrato, a cobrança da taxa) escolhiam a estadia só pela
  candidatura — sempre a proposta aceite mais recente. A estadia anterior sem contrato (o caso real: a ORC-2026-0015,
  "em contrato" sem contrato, ao lado da ORC-2026-0019 com o contrato 2384e69d) só levava ao orçamento: o dono não a
  conseguia fechar.
  Depois: a linha dessa estadia abre o assistente com `?c=<candidatura>&p=<proposta>`; o `p` é validado no servidor
  (`propostaDoFechamento`: da candidatura, e acordada) e segue até ao contrato e à taxa, para nunca se cobrar nem gerar
  a estadia errada. Sem `p`, tudo fica como antes. A estadia que já tem contrato leva ao contrato.
  Roda: node --test src/lib/fechamento/e1141-assistente-da-estadia-anterior.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { propostaDoFechamento } from "./proposta-do-fechamento.ts";
import { fechosDoDono, type CandidaturaDoFecho, type ContratoDoFecho, type PropostaDoFecho } from "./fechos-do-dono.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => fonteSemComentarios(readFileSync(p, "utf8"));
const corpoDe = (fonte: string, inicio: string) => {
  const i = fonte.indexOf(inicio);
  assert.ok(i >= 0, inicio);
  const fim = fonte.indexOf("\n}\n", i);
  return fonte.slice(i, fim < 0 ? undefined : fim);
};

const LEAD = "e7b1f322";
const linhaP = (id: string, status: string, lead = LEAD) => ({ id, lead_id: lead, status });

test("a regra pura: sem p é o padrão; com p, só a proposta acordada desta candidatura", () => {
  assert.equal(propostaDoFechamento({ leadId: LEAD, propostaId: null, proposta: null }), "padrao");
  assert.equal(propostaDoFechamento({ leadId: LEAD, propostaId: undefined, proposta: null }), "padrao");
  for (const status of ["aceita", "em_contrato", "contrato_assinado"]) {
    assert.equal(propostaDoFechamento({ leadId: LEAD, propostaId: "orc15", proposta: linhaP("orc15", status) }), "escolhida", status);
  }
  assert.equal(propostaDoFechamento({ leadId: LEAD, propostaId: "orc15", proposta: null }), "fora", "não existe");
  assert.equal(propostaDoFechamento({ leadId: LEAD, propostaId: "orc15", proposta: linhaP("orc15", "aceita", "outra") }), "fora", "de outra candidatura");
  assert.equal(propostaDoFechamento({ leadId: LEAD, propostaId: "orc15", proposta: linhaP("orc99", "aceita") }), "fora", "outra proposta");
  for (const status of ["enviada", "expirada", "recusada", "cancelada"]) {
    assert.equal(propostaDoFechamento({ leadId: LEAD, propostaId: "orc15", proposta: linhaP("orc15", status) }), "fora", status);
  }
});

const DONO = "dono-1";
const cand = (id: string, aceitaEm: string, extra: Partial<CandidaturaDoFecho> = {}): CandidaturaDoFecho => ({ id, donoId: DONO, imovel: `Imóvel ${id}`, morador: `Morador ${id}`, aceitaEm, preAceiteExpirado: false, periodo: null, ...extra });
const prop = (id: string, leadId: string, aceitaEm: string, status = "aceita"): PropostaDoFecho => ({ id, leadId, numero: `ORC-${id}`, status, aceitaEm, periodo: null });
const contr = (id: string, leadId: string, propostaId: string | null, criadoEm: string): ContratoDoFecho => ({ id, leadId, propostaId, criadoEm, periodo: null, estado: { selo: "Em vigência", etapa: "em_vigencia" } });

test("a lista: a estadia anterior sem contrato abre o assistente dela (?c=&p=); a mais recente segue como antes", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand(LEAD, "2026-11-21T10:00:00Z")],
    propostas: [prop("orc15", LEAD, "2026-11-21T10:00:00Z", "em_contrato"), prop("orc19", LEAD, "2026-11-22T10:00:00Z", "contrato_assinado")],
    contratos: [contr("2384e69d-0000-0000-0000-000000000019", LEAD, "orc19", "2026-11-22T12:00:00Z")],
  });
  const anterior = r.linhas.find((l) => l.propostaId === "orc15")!;
  assert.equal(anterior.acao.tipo, "assistente");
  assert.equal(anterior.acao.href, `/dashboard/fechamento?c=${LEAD}&p=orc15`);
  assert.equal(anterior.acao.tipo === "assistente" && anterior.acao.anterior, true);
  const nova = r.linhas.find((l) => l.propostaId === "orc19")!;
  assert.equal(nova.acao.tipo, "assistente", "a mais recente abre o assistente como antes");
  assert.equal(nova.acao.href, `/dashboard/fechamento?c=${LEAD}`, "sem p: o comportamento de hoje");
  assert.equal(r.abrir, LEAD);
});

test("a lista: a estadia anterior COM contrato leva ao contrato, nunca reabre o assistente", () => {
  const r = fechosDoDono({
    donoId: DONO,
    candidaturas: [cand(LEAD, "2026-11-01T10:00:00Z")],
    propostas: [prop("orc10", LEAD, "2026-11-01T10:00:00Z", "contrato_assinado"), prop("orc19", LEAD, "2026-11-22T10:00:00Z")],
    contratos: [contr("11111111-0000-0000-0000-000000000010", LEAD, "orc10", "2026-11-02T10:00:00Z")],
  });
  const anterior = r.linhas.find((l) => l.propostaId === "orc10")!;
  assert.equal(anterior.acao.tipo, "contrato");
  assert.equal(anterior.acao.href, "/dashboard/contratos/11111111-0000-0000-0000-000000000010");
  assert.equal(r.linhas.find((l) => l.propostaId === "orc19")!.acao.href, `/dashboard/fechamento?c=${LEAD}`);
});

test("a fiação: a proposta escolhida segue do assistente até ao contrato e à taxa; sem p, a regra de antes", () => {
  const servidor = ler("src/lib/data/propostas-servidor.ts");
  assert.match(servidor, /export async function propostaDoFechamentoDoLead\(/);
  assert.match(corpoDe(servidor, "export async function propostaDoFechamentoDoLead("), /propostaDoFechamento\(/, "o servidor decide pela regra pura");

  const pontos: [string, string, RegExp][] = [
    ["src/lib/data/leads-actions.ts", "export async function getFechamentoContext(", /propostaDoFechamentoDoLead\(admin, lead\.id as string, propostaId/],
    ["src/lib/data/fechamento-servidor.ts", "export async function carregarFechamento(", /propostaDoFechamentoDoLead\(admin, lead\.id as string, propostaPedida\)/],
    ["src/lib/data/fechamento-servidor.ts", "export async function comissaoDoContrato(", /propostaDoFechamentoDoLead\(admin, leadId, propostaPedida\)/],
    ["src/app/api/contrato/route.ts", "export async function POST(", /propostaDoFechamentoDoLead\(admin, f\.leadId, f\.propostaPedida\)/],
    ["src/app/api/comissao/route.ts", "export async function POST(", /comissaoDoContrato\(f\.leadId, f\.propostaPedida\)/],
    ["src/lib/data/actions.ts", "export async function registrarContrato(", /propostaDoFechamentoDoLead\(admin, lead\.id as string, input\.propostaId/],
  ];
  for (const [arquivo, inicio, chamada] of pontos) {
    const corpo = corpoDe(ler(arquivo), inicio);
    assert.match(corpo, chamada, `${arquivo} › ${inicio}`);
    assert.doesNotMatch(corpo, /propostaAcordadaDoLead\(/, `${arquivo} › ${inicio}: nada escolhe a estadia só pela candidatura`);
  }

  const fluxo = ler("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.equal((fluxo.match(/\.\.\.\(ctx\.propostaDaUrl \? \{ propostaId: ctx\.propostaDaUrl \} : \{\}\)/g) ?? []).length, 3, "o contrato, o registro e a taxa levam a proposta escolhida");

  const pagina = ler("src/app/(dashboard)/dashboard/fechamento/page.tsx");
  assert.match(pagina, /getFechamentoContext\(c, p\)/, "a página lê o p");
  assert.match(pagina, /redirect\(`\/dashboard\/contratos\/\$\{/, "a estadia escolhida que já tem contrato leva ao contrato");
});
