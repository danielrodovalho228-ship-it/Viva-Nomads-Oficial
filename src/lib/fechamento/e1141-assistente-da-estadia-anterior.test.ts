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
import { propostaDoFechamento, taxaDaEstadia } from "./proposta-do-fechamento.ts";
import { filtroDaChave } from "../contrato-da-proposta.ts";
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
  // E1141 (ajuste da guarda, ORDEM-DUET-977/978): sem redirect — a estadia escolhida com contrato abre o resumo só para leitura.
  assert.doesNotMatch(pagina, /redirect\(/, "a página não redireciona (o redirect partia o fim do fecho com p)");
});

/* ---- As quatro guardas do coordenador (ORDEM-DUET-933): dinheiro e contrato. ---- */
test("guarda 1 — a taxa cobra-se uma vez por ESTADIA (a chave é a proposta, não a candidatura)", () => {
  assert.notDeepEqual(filtroDaChave("orc15"), filtroDaChave("orc19"), "a ORC-0015 e a ORC-0019 têm chaves diferentes");
  const mig = readFileSync("supabase/migrations/0353_contrato_por_proposta_e1086.sql", "utf8");
  assert.match(mig, /create unique index if not exists cobrancas_fechamento_chave\s+on public\.cobrancas_fechamento \(lead_id, tipo, coalesce\(proposta_id/);
  const comissao = ler("src/app/api/comissao/route.ts");
  assert.match(comissao, /const contrato = await comissaoDoContrato\(f\.leadId, f\.propostaPedida\)/, "o contrato (e a chave) é o da estadia escolhida");
  assert.match(comissao, /const chave = contrato\.propostaId;/);
  for (const passo of ["lerReservaFechamento", "reservarFechamento"]) assert.match(comissao, new RegExp(`${passo}\\(f\\.leadId, "comissao", chave\\)`));
  assert.doesNotMatch(comissao, /Fechamento\(f\.leadId, "comissao"\)/, "nenhuma reserva só pela candidatura");
});

test("guarda 2 — a taxa é a CONGELADA da proposta escolhida (nunca a da mais recente nem a de hoje)", () => {
  assert.equal(taxaDaEstadia(0.12, 0.08), 0.12, "a ORC antiga cobra a sua");
  assert.equal(taxaDaEstadia(0.08, 0.12), 0.08, "a ORC nova cobra a sua");
  assert.equal(taxaDaEstadia(null, 0.08), 0.08, "sem taxa congelada na proposta: a do aceite, como antes");
  assert.equal(taxaDaEstadia(undefined, null), null);
  const reg = corpoDe(ler("src/lib/data/actions.ts"), "export async function registrarContrato(");
  assert.match(reg, /const rate = taxaDoContrato\(taxaDaEstadia\(acordada\?\.taxa, taxaLead\?\.acceptedCommissionRate\), taxaLead\?\.acceptedPlan \?\? null\);/);
  const ctx = corpoDe(ler("src/lib/data/leads-actions.ts"), "export async function getFechamentoContext(");
  assert.match(ctx, /taxaDaEstadia\(taxaDaProposta, taxaLead\?\.acceptedCommissionRate\)/, "o assistente mostra a taxa da estadia escolhida");
});

test("guarda 3 — o período que cruza outro contrato é avisado ANTES de gerar o documento e de cobrar", () => {
  const reg = corpoDe(ler("src/lib/data/actions.ts"), "export async function registrarContrato(");
  const conflito = reg.indexOf("const conflito = await conflitoNoImovel(");
  const soConferir = reg.indexOf("if (opcoes?.soConferir) return { ok: true, conferido: true };");
  const insercao = reg.indexOf('.from("contratos")\n    .insert(');
  assert.ok(conflito > 0 && soConferir > conflito && insercao > soConferir, "a conferência para depois do conflito e antes de gravar");
  const fluxo = ler("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  const conferir = fluxo.indexOf("{ soConferir: true }");
  assert.ok(conferir > 0 && conferir < fluxo.indexOf('await fetch("/api/contrato"'), "confere antes do documento");
  assert.ok(conferir < fluxo.indexOf('await fetch("/api/comissao"'), "e antes da taxa");
  assert.match(fluxo, /if \(!conferido\.ok\) \{\s*setErroContrato\(conferido\.error \?\? [^)]+\);\s*return;\s*\}/, "com conflito, mostra a mensagem e não segue");
});

test("guarda 4 — o p valida-se em CADA rota, antes de qualquer efeito, com a mesma mensagem", () => {
  for (const rota of ["comissao", "contrato"]) {
    const src = ler(`src/app/api/${rota}/route.ts`);
    const carregar = src.indexOf("await carregarFechamento(body.leadId, body.propostaId)");
    assert.ok(carregar > 0, `${rota}: valida o p`);
    for (const efeito of ["reservarFechamento(", "createCommissionCharge(", "createContract("]) {
      const i = src.indexOf(efeito);
      if (i > 0) assert.ok(carregar < i, `${rota}: valida antes de ${efeito}`);
    }
  }
  const carregar = corpoDe(ler("src/lib/data/fechamento-servidor.ts"), "export async function carregarFechamento(");
  const fora = carregar.indexOf("if (acordada === PROPOSTA_FORA_DO_FECHAMENTO) return { status: 404, error: MSG_FECHO_NAO_ENCONTRADO };");
  assert.ok(fora > 0 && fora < carregar.indexOf("motivoBloqueioContrato("), "o p alheio cai antes de tudo o resto");
  assert.match(ler("src/lib/data/fechamento-servidor.ts"), /export const MSG_FECHO_NAO_ENCONTRADO = "Não encontramos esse fechamento\.";/);
});

test("guarda 3 sem p (ORDEM-DUET-939) — o período cruzado avisa-se ANTES em TODOS os fechos, não só na estadia escolhida", () => {
  const fluxo = ler("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  const i = fluxo.indexOf("async function generateContract(");
  const gerar = fluxo.slice(i, fluxo.indexOf("\n  }\n", i));
  assert.doesNotMatch(gerar, /if \(ctx\.propostaDaUrl\) \{\s*const conferido/, "a conferência não depende do p");
  const conferir = gerar.indexOf("await registrarContrato(entradaDoContrato, { soConferir: true })");
  assert.ok(conferir > 0, "o fecho sem p também confere");
  assert.ok(conferir < gerar.indexOf('await fetch("/api/contrato"') && conferir < gerar.indexOf('await fetch("/api/comissao"'), "antes do documento e da taxa");
  // Sem p, o sucesso é o mesmo de antes: a entrada da conferência é a mesma do registro, e sem p não leva proposta.
  assert.match(gerar, /\.\.\.\(ctx\.propostaDaUrl \? \{ propostaId: ctx\.propostaDaUrl \} : \{\}\)/);
});

test("ajuste da guarda (ORDEM-DUET-978): com p e contrato já existente ao abrir, o assistente é só leitura — o resumo, sem 'Gerar contrato'", () => {
  const fluxo = ler("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  // Decide-se UMA vez, na montagem: o contrato gerado agora (que a página revalidada passa a ter) NÃO vira leitura.
  assert.match(fluxo, /const \[somenteLeitura\] = useState\(\(\) => !demo && Boolean\(ctx\.propostaDaUrl\) && Boolean\(ctx\.contratoExistente\)\);/);
  assert.match(fluxo, /const \[step, setStep\] = useState\(\(\) => \(somenteLeitura \? STEPS\.length - 1 : 0\)\);/, "abre no resumo");
  const acao = fluxo.slice(fluxo.indexOf('data-testid="acao-gerar-contrato"'), fluxo.indexOf('data-testid="fechamento-gerar-contrato"'));
  assert.match(acao, /somenteLeitura \? \(/, "só leitura troca o botão de gerar pelo 'Ver contrato'");
  assert.match(fluxo, /data-testid=\{somenteLeitura \? "fechamento-somente-leitura" : undefined\}/, "a marca da leitura fica no 'Ver contrato' do topo");
});
