/*
  E1247, passo 2 — PR 2, O PRÉ-ACEITE (ESPEC-E1247-PASSO-2, secção 5; ORDEM-DUET 1345, com as decisões da ORDEM-1316).
  Os quatro avisos da pré-aceitação de 72 h deixam o evento do contrato e passam a eventos PRÓPRIOS, com a PROPOSTA
  como referência:
   - "pre_aceite_prazo" (5): o lembrete de 24 h e de 6 h — morador CRÍTICO, dono normal; resolve-se quando o contrato é
     gerado, e na rotina antes de ela enviar o 6, o 7 ou o 8;
   - "pre_aceite_expirou" (6): a janela terminou — dono CRÍTICO (decisão 1), morador normal; resolve-se na reabertura e,
     o do DONO, quando o prazo dele vence (o passo novo, decisão 3 — cobre também o dono que responde à candidatura
     devolvida sem a reabrir);
   - "pre_aceite_perdeu_vez" (7): os dois, normal; resolve-se como o 6;
   - "pre_aceite_encerrado" (8): os dois, normal; só informa.
  A ROTINA e a reabertura REAIS correm no harness e1247-pre-aceite-harness: o aviso grava-se pela gravarAviso real num
  banco falso fiel (a renovação do E1251 e a referência entram de verdade).
  Roda: node --test src/lib/propostas/e1247-passo2-pre-aceite.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.NEXT_PUBLIC_PRE_ACEITACAO_72H_ATIVA = "on";
register("./e1247-pre-aceite-harness/loader.mjs", import.meta.url);
const { rodarPreAceitacao, reabrirNoBanco } = await import("./pre-aceitacao-servidor.ts");
const { marcarPropostaEmContrato } = await import("../data/propostas-servidor.ts");
const { ASSUNTOS } = await import("../notifications/assuntos.ts");
const { prioridadeDoAviso } = await import("../notifications/avisos.ts");
const { acaoDaFaixa } = await import("../notifications/sino.ts");
const { MATRIZ_NOTIFICACOES, canaisDoEvento } = await import("../../config/matriz-notificacoes.ts");
const { TEMPLATES } = await import("../notifications/eventos-email.ts");
const rotinas = (await import("../notifications/avisos-rotinas-contrato.ts")) as unknown as {
  avisoDaRotina: (k: string, p: "proprietario" | "inquilino") => { titulo: string; prioridade: string; botao: string };
  EVENTO_DA_ROTINA: Record<string, string | undefined>;
};

// ——— o banco falso, fiel (filtros, projeção pelo select, escritas aplicadas) ———
type Linha = Record<string, unknown>;
let banco: Record<string, Linha[]>;
let seq = 0;
function partes(s: string): string[] {
  const out: string[] = [];
  let nivel = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function tabela(nome: string) {
  const filtros: ((l: Linha) => boolean)[] = [];
  let cols: string[] | null = null;
  let op: { tipo: "select" } | { tipo: "update"; valor: Linha } | { tipo: "delete" } | { tipo: "insert"; linhas: Linha[] } = { tipo: "select" };
  let limite: number | null = null;
  const linhas = () => (banco[nome] ??= []);
  const projetar = (l: Linha) => {
    if (!cols) return { ...l };
    const o: Linha = {};
    for (const c of cols) o[c.split("(")[0].trim()] = l[c.split("(")[0].trim()];
    return o;
  };
  const executar = () => {
    const alvo = linhas().filter((l) => filtros.every((f) => f(l)));
    if (op.tipo === "update") {
      for (const l of alvo) Object.assign(l, op.valor);
      return { data: alvo.map(projetar), error: null };
    }
    if (op.tipo === "delete") {
      banco[nome] = linhas().filter((l) => !alvo.includes(l));
      return { data: null, error: null };
    }
    if (op.tipo === "insert") {
      for (const l of op.linhas) linhas().push({ id: `${nome}-${++seq}`, criado_em: new Date(Date.now() + seq).toISOString(), lido_em: null, resolvido_em: null, ...l });
      return { data: null, error: null };
    }
    const r = alvo.map(projetar);
    return { data: limite == null ? r : r.slice(0, limite), error: null };
  };
  const q: Record<string, unknown> = {
    select(s?: string) {
      if (s && op.tipo === "select") cols = partes(s);
      return q;
    },
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    neq: (c: string, v: unknown) => (filtros.push((l) => l[c] !== v), q),
    in: (c: string, vs: unknown[]) => (filtros.push((l) => vs.includes(l[c])), q),
    is: (c: string, v: unknown) => (filtros.push((l) => (l[c] ?? null) === v), q),
    not: (c: string, o: string, v: unknown) => (filtros.push((l) => (o === "is" ? (l[c] ?? null) !== v : true)), q),
    gte: (c: string, v: string | number) => (filtros.push((l) => (l[c] as string | number) >= v), q),
    lte: (c: string, v: string | number) => (filtros.push((l) => (l[c] as string | number) <= v), q),
    lt: (c: string, v: string | number) => (filtros.push((l) => (l[c] as string | number) < v), q),
    order: () => q,
    limit: (n: number) => ((limite = n), q),
    update: (valor: Linha) => ((op = { tipo: "update", valor }), q),
    delete: () => ((op = { tipo: "delete" }), q),
    insert: (v: Linha | Linha[]) => ((op = { tipo: "insert", linhas: Array.isArray(v) ? v : [v] }), q),
    upsert: () => q,
    maybeSingle: async () => {
      const r = executar();
      return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: null };
    },
    single: async () => {
      const r = executar();
      return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: null };
    },
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, ko),
  };
  return q;
}
const admin = { from: (t: string) => tabela(t) };
const g = globalThis as unknown as { __e1247aAdmin: unknown; __e1247aEnvios: Record<string, unknown>[] };

const DONO = "d0d0d0d0-0000-4000-8000-000000000001";
const MORADOR = "a0a0a0a0-0000-4000-8000-000000000002";
const OUTRO = "a0a0a0a0-0000-4000-8000-000000000003";
const IM = "f0f0f0f0-0000-4000-8000-000000000001";
const IM2 = "f0f0f0f0-0000-4000-8000-000000000002";
const PA = "b0b0b0b0-0000-4000-8000-00000000000a";
const PB = "b0b0b0b0-0000-4000-8000-00000000000b";
// O prazo da janela acaba a 02/12 15:00 BRT (18:00Z): o lembrete de 24 h sai a 01/12 15:00 BRT, o de 6 h a 02/12 09:00.
const PRAZO = "2026-12-02T18:00:00.000Z";
const EM24 = new Date("2026-12-01T18:30:00.000Z");
const EM6 = new Date("2026-12-02T12:30:00.000Z");
const DEPOIS = new Date("2026-12-02T19:00:00.000Z");

const proposta = (id: string, extra: Linha = {}): Linha => ({
  id, numero: `P-${id.slice(-1)}`, owner_id: DONO, tenant_id: MORADOR, lead_id: `lead-${id.slice(-1)}`, property_id: IM, versao_atual: 1, status: "aceita",
  aceita_em: "2026-11-29T18:00:00.000Z", pre_aceitacao_reaberturas: 0, pre_aceitacao_ate: PRAZO, pre_aceitacao_lembrete_24h_em: null, pre_aceitacao_lembrete_6h_em: null,
  pre_aceitacao_expirou_em: null, pre_aceitacao_perdeu_em: null, pre_aceitacao_encerrada_em: null, pre_aceitacao_dono_ate: null, taxa_congelada: 0.12, properties: { title: "Apto Centro" }, ...extra,
});
const versao = (propostaId: string): Linha => ({ id: `v-${propostaId}`, proposta_id: propostaId, versao: 1, autor: "owner", valor_base: 3200, desconto_pct: 0, desconto_valor: 0, motivo_desconto: null, desconto_estadia_pct: 0, valor_mensal: 3200, meses: 2, dias: null, data_entrada: "2026-12-10", condominio: 0, consumo: 0, limpezas_mes: 0, limpezas_pacote: 0, valor_limpeza: 0, taxa_pet: 0, limpeza_unica: 0, pessoas: 1, total_mensal: 3200, total_contrato: 6400, mensagem: null, criada_em: "2026-11-28T00:00:00.000Z", forma_pagamento: null });

function semear(propostas: Linha[], extra: Partial<Record<string, Linha[]>> = {}) {
  seq = 0;
  banco = {
    propostas,
    proposta_versoes: propostas.map((p) => versao(String(p.id))),
    profiles: [
      { id: DONO, email: "dono@teste.invalid", full_name: "Dono" },
      { id: MORADOR, email: "morador@teste.invalid", full_name: "Morador" },
      { id: OUTRO, email: "outro@teste.invalid", full_name: "Outro" },
    ],
    contratos: [],
    leads: [],
    avisos: [],
    contrato_blocos: [],
    ...extra,
  };
  g.__e1247aAdmin = admin;
  g.__e1247aEnvios = [];
}
const avisos = (f: (a: Linha) => boolean = () => true) => banco.avisos.filter(f);
const de = (ev: string, uid: string, ref?: string) => avisos((a) => a.evento === ev && a.usuario_id === uid && (ref ? a.ref_id === ref : true));
const aberto = (a: Linha | undefined) => !!a && (a.resolvido_em ?? null) === null;
/** Resolvido: o aviso EXISTE e tem resolvido_em (um aviso que não nasceu não conta como resolvido). */
const resolvido = (a: Linha | undefined) => !!a && !!a.resolvido_em;
beforeEach(() => semear([]));

test("A1. o lembrete de 24 h: pre_aceite_prazo, morador CRÍTICO, dono normal, os dois com a proposta como referência", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, EM24);
  const [m] = de("pre_aceite_prazo", MORADOR);
  const [d] = de("pre_aceite_prazo", DONO);
  assert.equal(m?.prioridade, "critico");
  assert.equal(d?.prioridade, "normal");
  assert.equal(m?.ref_id, PA);
  assert.equal(d?.ref_id, PA);
  assert.equal(m?.titulo, ASSUNTOS.preAceitacaoLembrete);
  assert.equal(avisos((a) => a.evento === "contract_status").length, 0, "já não viaja com o evento do contrato");
});

test("A2. o lembrete de 6 h, com o de 24 por ler: uma linha só por pessoa; a do morador continua crítica", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, EM24);
  await rodarPreAceitacao(admin as never, EM6);
  assert.equal(de("pre_aceite_prazo", MORADOR).length, 1);
  assert.equal(de("pre_aceite_prazo", DONO).length, 1);
  assert.equal(de("pre_aceite_prazo", MORADOR)[0].prioridade, "critico");
});

test("A3. o contrato é gerado: os lembretes dos dois saem", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, EM24);
  await marcarPropostaEmContrato(admin as never, PA);
  assert.ok(resolvido(de("pre_aceite_prazo", MORADOR)[0]), "o do morador");
  assert.ok(resolvido(de("pre_aceite_prazo", DONO)[0]), "o do dono");
});

test("A4. a janela termina: os lembretes saem; nasce pre_aceite_expirou — dono CRÍTICO, morador normal", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, EM24);
  await rodarPreAceitacao(admin as never, DEPOIS);
  assert.ok(resolvido(de("pre_aceite_prazo", MORADOR)[0]) && resolvido(de("pre_aceite_prazo", DONO)[0]), "os lembretes saem");
  const [d] = de("pre_aceite_expirou", DONO);
  const [m] = de("pre_aceite_expirou", MORADOR);
  assert.equal(d?.prioridade, "critico", "decisão 1: o do dono é crítico");
  assert.equal(m?.prioridade, "normal");
  assert.equal(d?.ref_id, PA);
  assert.ok(aberto(d) && aberto(m));
});

test("A5. a proposta perde a vez: os lembretes saem; nasce pre_aceite_perdeu_vez, normal, aos dois", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, EM24);
  banco.contratos.push({ id: "c-outro", property_id: IM, status: "ativo", periodo: "[2026-12-10,2027-02-08)" });
  await rodarPreAceitacao(admin as never, EM6);
  assert.ok(resolvido(de("pre_aceite_prazo", MORADOR)[0]) && resolvido(de("pre_aceite_prazo", DONO)[0]), "os lembretes saem");
  for (const uid of [DONO, MORADOR]) {
    const [a] = de("pre_aceite_perdeu_vez", uid);
    assert.equal(a?.prioridade, "normal", uid);
    assert.equal(a?.ref_id, PA);
  }
});

test("A6. a 3.ª expiração: os lembretes saem; nasce pre_aceite_encerrado, normal, aos dois", async () => {
  semear([proposta(PA, { pre_aceitacao_reaberturas: 2 })]);
  await rodarPreAceitacao(admin as never, EM24);
  await rodarPreAceitacao(admin as never, DEPOIS);
  assert.ok(resolvido(de("pre_aceite_prazo", MORADOR)[0]) && resolvido(de("pre_aceite_prazo", DONO)[0]), "os lembretes saem");
  for (const uid of [DONO, MORADOR]) assert.equal(de("pre_aceite_encerrado", uid)[0]?.prioridade, "normal", uid);
  assert.equal(de("pre_aceite_expirou", DONO).length, 0);
});

test("A7. a proposta é reaberta: os avisos 6 e 7 dos dois saem", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, DEPOIS);
  // Um 7 antigo da mesma proposta (perdeu a vez antes), por resolver, aos dois.
  for (const uid of [DONO, MORADOR]) banco.avisos.push({ id: `pv-${uid}`, usuario_id: uid, evento: "pre_aceite_perdeu_vez", ref_id: PA, titulo: ASSUNTOS.preAceitacaoPerdeuVez, prioridade: "normal", lido_em: null, resolvido_em: null, criado_em: "2026-12-01T00:00:00.000Z" });
  const r = await reabrirNoBanco(admin as never, PA, "owner", new Date("2026-12-03T12:00:00.000Z"));
  assert.equal(r.ok, true, JSON.stringify(r));
  for (const ev of ["pre_aceite_expirou", "pre_aceite_perdeu_vez"]) for (const uid of [DONO, MORADOR]) assert.ok(resolvido(de(ev, uid, PA)[0]), `${ev}/${uid}`);
});

test("A8. o prazo do dono vence: o aviso 6 (ou 7) do DONO sai; o do morador fica — sem mexer na proposta", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, DEPOIS);
  const donoAte = String(banco.propostas[0].pre_aceitacao_dono_ate);
  assert.ok(donoAte && donoAte !== "null", "a expiração gravou o prazo do dono");
  for (const uid of [DONO, MORADOR]) banco.avisos.push({ id: `pv-${uid}`, usuario_id: uid, evento: "pre_aceite_perdeu_vez", ref_id: PA, titulo: ASSUNTOS.preAceitacaoPerdeuVez, prioridade: "normal", lido_em: null, resolvido_em: null, criado_em: "2026-12-01T00:00:00.000Z" });
  const antes = JSON.stringify(banco.propostas[0]);
  await rodarPreAceitacao(admin as never, new Date(new Date(donoAte).getTime() + 60_000));
  assert.ok(resolvido(de("pre_aceite_expirou", DONO)[0]), "o 6 do dono sai");
  assert.ok(resolvido(de("pre_aceite_perdeu_vez", DONO)[0]), "o 7 do dono sai");
  assert.ok(aberto(de("pre_aceite_expirou", MORADOR)[0]), "o 6 do morador fica");
  assert.ok(aberto(de("pre_aceite_perdeu_vez", MORADOR)[0]), "o 7 do morador fica");
  assert.equal(JSON.stringify(banco.propostas[0]), antes, "a proposta não muda");
});

test("A9. o prazo do dono ainda não venceu: nada sai", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, DEPOIS);
  const donoAte = new Date(String(banco.propostas[0].pre_aceitacao_dono_ate));
  await rodarPreAceitacao(admin as never, new Date(donoAte.getTime() - 60_000));
  assert.ok(aberto(de("pre_aceite_expirou", DONO)[0]));
  assert.ok(aberto(de("pre_aceite_expirou", MORADOR)[0]));
});

test("A9b (fuga Y2, ORDEM-DUET 1350). a fronteira: agora é EXATAMENTE o prazo do dono — o aviso do dono fica aberto (só sai com o prazo já passado)", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, DEPOIS);
  const donoAte = new Date(String(banco.propostas[0].pre_aceitacao_dono_ate));
  await rodarPreAceitacao(admin as never, donoAte);
  assert.ok(aberto(de("pre_aceite_expirou", DONO)[0]), "no instante exato do prazo, o aviso do dono fica");
  await rodarPreAceitacao(admin as never, new Date(donoAte.getTime() + 1));
  assert.ok(resolvido(de("pre_aceite_expirou", DONO)[0]), "um milissegundo depois, sai");
});

test("A10 (com a fuga Y16, ORDEM-DUET 1350). o passo novo corre duas vezes: o mesmo resultado — e o resolvido_em do dono fica IGUAL", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, DEPOIS);
  const depois = new Date(new Date(String(banco.propostas[0].pre_aceitacao_dono_ate)).getTime() + 60_000);
  await rodarPreAceitacao(admin as never, depois);
  const doDono = de("pre_aceite_expirou", DONO)[0];
  assert.ok(resolvido(doDono), "a 1.ª corrida resolve o do dono");
  // Um instante conhecido, para a 2.ª corrida não poder coincidir com ele no mesmo milissegundo: se ela o regravar, cai.
  doDono.resolvido_em = "2026-12-03T00:00:00.000Z";
  const retrato = JSON.stringify(banco.avisos);
  await rodarPreAceitacao(admin as never, new Date(depois.getTime() + 3_600_000));
  assert.equal(de("pre_aceite_expirou", DONO)[0].resolvido_em, "2026-12-03T00:00:00.000Z", "a 2.ª corrida não regrava o resolvido_em do dono");
  assert.equal(JSON.stringify(banco.avisos), retrato, "nem nada mais");
});

test("A11. a mesma pessoa é moradora numa proposta e dona noutra: duas linhas, uma por proposta; a da moradora crítica", async () => {
  semear([proposta(PA), proposta(PB, { owner_id: MORADOR, tenant_id: OUTRO, property_id: IM2 })]);
  await rodarPreAceitacao(admin as never, EM24);
  const meus = de("pre_aceite_prazo", MORADOR);
  assert.equal(meus.length, 2, "duas linhas");
  assert.equal(meus.find((a) => a.ref_id === PA)?.prioridade, "critico", "moradora em PA");
  assert.equal(meus.find((a) => a.ref_id === PB)?.prioridade, "normal", "dona em PB");
});

test("A12. duas propostas do mesmo morador: duas linhas", async () => {
  semear([proposta(PA), proposta(PB, { property_id: IM2 })]);
  await rodarPreAceitacao(admin as never, EM24);
  assert.deepEqual(de("pre_aceite_prazo", MORADOR).map((a) => a.ref_id).sort(), [PA, PB]);
});

test("A13. o aviso \"proposta recebida\" da mesma proposta não é tocado", async () => {
  semear([proposta(PA)]);
  for (const uid of [DONO, MORADOR]) banco.avisos.push({ id: `rec-${uid}`, usuario_id: uid, evento: "proposta_recebida", ref_id: PA, titulo: "Proposta recebida", prioridade: "critico", lido_em: null, resolvido_em: null, criado_em: "2026-11-28T00:00:00.000Z" });
  await rodarPreAceitacao(admin as never, EM24);
  await rodarPreAceitacao(admin as never, DEPOIS);
  await rodarPreAceitacao(admin as never, new Date(new Date(String(banco.propostas[0].pre_aceitacao_dono_ate)).getTime() + 60_000));
  await reabrirNoBanco(admin as never, PA, "owner", new Date("2026-12-03T12:00:00.000Z"));
  await marcarPropostaEmContrato(admin as never, PA);
  for (const uid of [DONO, MORADOR]) assert.ok(aberto(banco.avisos.find((a) => a.id === `rec-${uid}`)), uid);
});

test("A14. o e-mail dos quatro: assunto, corpo e botão iguais aos de hoje; a categoria e os canais, os do evento do contrato", async () => {
  semear([proposta(PA)]);
  await rodarPreAceitacao(admin as never, EM24);
  const env = g.__e1247aEnvios as { event: string; subject: string; ctaLabel: string; body: (n?: string) => string; userId: string; pushUrl: string }[];
  const doMorador = env.find((e) => e.userId === MORADOR)!;
  assert.equal(doMorador.event, "pre_aceite_prazo");
  assert.equal(doMorador.subject, ASSUNTOS.preAceitacaoLembrete);
  assert.equal(doMorador.ctaLabel, "Ver a proposta");
  assert.equal(doMorador.pushUrl, `/dashboard/propostas/${PA}`);
  assert.match(doMorador.body("Ana"), /^Olá Ana, faltam 24 horas para concluir o contrato: o prazo termina em .+ \(Apto Centro, proposta P-a\)\.$/);
  const M = MATRIZ_NOTIFICACOES as Record<string, { categoria: string }>;
  for (const ev of ["pre_aceite_prazo", "pre_aceite_expirou", "pre_aceite_perdeu_vez", "pre_aceite_encerrado"]) {
    assert.equal(M[ev]?.categoria, M.contract_status.categoria, `${ev}: a mesma categoria (decide-se no E1161)`);
    for (const papel of ["morador", "proprietario"] as const) assert.deepEqual(canaisDoEvento(ev as never, papel), canaisDoEvento("contract_status", papel), `${ev}/${papel}: os mesmos canais`);
    assert.ok((TEMPLATES as Record<string, unknown>)[ev], `${ev} no catálogo`);
  }
});

test("P. a prioridade: a tabela das rotinas e a geral dizem o mesmo; o botão da faixa pelo evento", () => {
  const ev = rotinas.EVENTO_DA_ROTINA;
  assert.equal(ev.preAceitacaoLembrete, "pre_aceite_prazo");
  assert.equal(ev.preAceitacaoExpirou, "pre_aceite_expirou");
  assert.equal(ev.preAceitacaoPerdeuVez, "pre_aceite_perdeu_vez");
  assert.equal(ev.preAceitacaoEncerrada, "pre_aceite_encerrado");
  assert.deepEqual(rotinas.avisoDaRotina("preAceitacaoExpirou", "proprietario"), { titulo: ASSUNTOS.preAceitacaoExpirou, prioridade: "critico", botao: "Responder à candidatura" }, "decisão 1");
  assert.equal(rotinas.avisoDaRotina("preAceitacaoExpirou", "inquilino").prioridade, "normal", "decisão 2");
  for (const [rotina, evento] of Object.entries(ev)) {
    for (const [papel, papelAviso] of [["inquilino", "morador"], ["proprietario", "dono"]] as const) {
      assert.equal(prioridadeDoAviso(evento as never, papelAviso), rotinas.avisoDaRotina(rotina, papel).prioridade, `${evento} (${papelAviso})`);
    }
  }
  assert.equal(acaoDaFaixa("pre_aceite_prazo", null), "Responder à proposta");
  assert.equal(acaoDaFaixa("pre_aceite_expirou", null), "Responder à candidatura");
});

test("E. estático: a chamada diz o evento próprio, a referência (a proposta) e o papel", () => {
  const src = readFileSync(new URL("./pre-aceitacao-servidor.ts", import.meta.url), "utf8");
  assert.match(src, /event: EVENTO_DA_ROTINA\[rotina\][^\n]*refId: l\.id[^\n]*papelAviso: papel === "inquilino" \? "morador" : "dono"/);
  assert.doesNotMatch(src, /event: "contract_status"/);
});
