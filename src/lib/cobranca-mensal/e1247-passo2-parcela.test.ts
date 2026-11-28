/*
  E1247, passo 2 — PR 1, A PARCELA (ESPEC-E1247-PASSO-2, secção 4; ORDEM-DUET 1331). Os dois avisos da cobrança mensal
  deixam o evento do contrato e passam a eventos PRÓPRIOS, com a PARCELA como referência:
   - "parcela_lembrete" (4): o lembrete de 5 e de 3 dias ao morador; resolve-se quando ele registra o pagamento, e na
     ROTINA quando a parcela vence sem pagamento ("vence em breve" deixa de ser verdade — decisão 4 do Gerente);
   - "parcela_registrada" (3): o aviso ao dono quando o morador registra; resolve-se quando o dono confirma.
  A prioridade sai da tabela das rotinas, e a tabela geral diz o mesmo (uma fonte só): as parcelas NUNCA chegam a crítico.
  O e-mail fica igual ao de hoje (assunto, corpo, botão, categoria e canais).
  A ROTINA e as AÇÕES REAIS correm no harness e1247-parcela-harness: o aviso grava-se pela gravarAviso real (a renovação
  do E1251 e a referência entram de verdade) num banco falso fiel.
  Roda: node --test src/lib/cobranca-mensal/e1247-passo2-parcela.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.NEXT_PUBLIC_COBRANCA_MENSAL_ATIVA = "on";
register("./e1247-parcela-harness/loader.mjs", import.meta.url);
const { rodarCobrancaMensal } = await import("./servidor.ts");
const { registrarPagamentoMensal, confirmarPagamentoMensal } = await import("./acoes.ts");
const { ASSUNTOS } = await import("../notifications/assuntos.ts");
const rotinas = (await import("../notifications/avisos-rotinas-contrato.ts")) as unknown as {
  avisoDaRotina: (k: string, p: "proprietario" | "inquilino") => { titulo: string; prioridade: string; botao: string };
  EVENTO_DA_ROTINA?: Record<string, string>;
};
const { prioridadeDoAviso } = await import("../notifications/avisos.ts");
const { acaoDaFaixa } = await import("../notifications/sino.ts");
const { MATRIZ_NOTIFICACOES, canaisDoEvento } = await import("../../config/matriz-notificacoes.ts");
const { TEMPLATES } = await import("../notifications/eventos-email.ts");

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
const g = globalThis as unknown as { __e1247pAdmin: unknown; __e1247pSessao: unknown; __e1247pEnvios: Record<string, unknown>[] };
const sessao = (uid: string) => ({ auth: { getUser: async () => ({ data: { user: { id: uid } } }) } });

const DONO = "d0d0d0d0-0000-4000-8000-000000000001";
const MORADOR = "a0a0a0a0-0000-4000-8000-000000000002";
const C1 = "c0c0c0c0-0000-4000-8000-000000000001";
const C2 = "c0c0c0c0-0000-4000-8000-000000000002";
const P1 = "e0e0e0e0-0000-4000-8000-000000000001";
const P2 = "e0e0e0e0-0000-4000-8000-000000000002";

function semear(parcelas: Linha[]) {
  seq = 0;
  banco = {
    // prazo_total_dias fora da faixa: a rotina não gera parcelas novas; as do teste são as semeadas.
    contratos: [C1, C2].map((id) => ({ id, status: "ativo", prazo_total_dias: 400, tenant_id: MORADOR, properties: { owner_id: DONO, title: "Apto Centro" } })),
    profiles: [
      { id: DONO, email: "dono@teste.invalid", full_name: "Dono" },
      { id: MORADOR, email: "morador@teste.invalid", full_name: "Morador" },
    ],
    cobranca_mensal_parcelas: parcelas,
    avisos: [],
    contrato_blocos: [],
  };
  g.__e1247pAdmin = admin;
  g.__e1247pSessao = sessao(MORADOR);
  g.__e1247pEnvios = [];
}
const parcela = (id: string, contrato: string, venceEm: string, extra: Linha = {}): Linha => ({ id, contrato_id: contrato, vence_em: venceEm, valor: 3200, estado_livro: null, lembrou_d5_em: null, lembrou_d3_em: null, ...extra });
const avisos = (f: (a: Linha) => boolean = () => true) => banco.avisos.filter(f);
const doEvento = (ev: string) => avisos((a) => a.evento === ev);
beforeEach(() => semear([]));

// Datas: a parcela vence a 10/12; o D-5 é 05/12 e o D-3 é 07/12 (meio-dia em Brasília).
const VENCE = "2026-12-10";
const EM = (dia: string) => new Date(`${dia}T15:00:00.000Z`);

test("P1. o lembrete de 5 dias: nasce parcela_lembrete, normal, com a parcela como referência", async () => {
  semear([parcela(P1, C1, VENCE)]);
  await rodarCobrancaMensal(admin as never, EM("2026-12-05"));
  const l = doEvento("parcela_lembrete");
  assert.equal(l.length, 1, "um aviso do evento próprio");
  assert.equal(l[0].usuario_id, MORADOR);
  assert.equal(l[0].ref_id, P1, "a referência é a parcela");
  assert.equal(l[0].prioridade, "normal");
  assert.equal(l[0].titulo, ASSUNTOS.lembreteParcelaAluguel);
  assert.equal(doEvento("contract_status").length, 0, "já não viaja com o evento do contrato");
});

test("P2. o lembrete de 3 dias, com o de 5 por ler: uma linha só, com a hora nova", async () => {
  semear([parcela(P1, C1, VENCE)]);
  await rodarCobrancaMensal(admin as never, EM("2026-12-05"));
  // A hora do de 5 dias recua para um instante conhecido: a renovação tem de a trocar.
  const antes = "2026-12-05T15:00:00.000Z";
  doEvento("parcela_lembrete")[0].criado_em = antes;
  await rodarCobrancaMensal(admin as never, EM("2026-12-07"));
  const l = doEvento("parcela_lembrete");
  assert.equal(l.length, 1, "renovado, não repetido");
  assert.notEqual(String(l[0].criado_em), antes, "com a hora nova");
});

test("P3. o lembrete de 3 dias, com o de 5 já lido: nasce outra linha; a lida fica como estava", async () => {
  semear([parcela(P1, C1, VENCE)]);
  await rodarCobrancaMensal(admin as never, EM("2026-12-05"));
  const lida = doEvento("parcela_lembrete")[0];
  lida.lido_em = "2026-12-05T20:00:00.000Z";
  await rodarCobrancaMensal(admin as never, EM("2026-12-07"));
  const l = doEvento("parcela_lembrete");
  assert.equal(l.length, 2);
  assert.equal(lida.lido_em, "2026-12-05T20:00:00.000Z");
  assert.equal(lida.resolvido_em ?? null, null);
});

test("P4. duas parcelas do mesmo morador (dois contratos), no mesmo dia: duas linhas", async () => {
  semear([parcela(P1, C1, VENCE), parcela(P2, C2, VENCE)]);
  await rodarCobrancaMensal(admin as never, EM("2026-12-05"));
  const l = doEvento("parcela_lembrete");
  assert.equal(l.length, 2, "hoje ficavam numa só (mesmo evento e título, sem referência)");
  assert.deepEqual(l.map((a) => a.ref_id).sort(), [P1, P2]);
});

test("P5. o morador registra o pagamento: o lembrete dessa parcela sai; nasce parcela_registrada ao dono, normal, com a parcela", async () => {
  semear([parcela(P1, C1, VENCE)]);
  await rodarCobrancaMensal(admin as never, EM("2026-12-05"));
  assert.deepEqual(await registrarPagamentoMensal(P1), { ok: true });
  const [lembrete] = doEvento("parcela_lembrete");
  assert.ok(lembrete.resolvido_em, "o lembrete fica resolvido");
  const r = doEvento("parcela_registrada");
  assert.equal(r.length, 1);
  assert.equal(r[0].usuario_id, DONO);
  assert.equal(r[0].ref_id, P1);
  assert.equal(r[0].prioridade, "normal");
  assert.equal(r[0].titulo, ASSUNTOS.pagamentoRegistradoMorador);
  assert.equal(r[0].resolvido_em ?? null, null);
});

test("P6. o dono confirma: o aviso dele sai", async () => {
  semear([parcela(P1, C1, VENCE)]);
  assert.deepEqual(await registrarPagamentoMensal(P1), { ok: true });
  g.__e1247pSessao = sessao(DONO);
  assert.deepEqual(await confirmarPagamentoMensal(P1), { ok: true });
  const [r] = doEvento("parcela_registrada");
  assert.ok(r.resolvido_em, "resolvido na confirmação");
});

test("P7. o morador registra uma parcela; a outra continua por pagar: sai só o lembrete da que pagou", async () => {
  semear([parcela(P1, C1, VENCE), parcela(P2, C2, VENCE)]);
  await rodarCobrancaMensal(admin as never, EM("2026-12-05"));
  assert.deepEqual(await registrarPagamentoMensal(P1), { ok: true });
  const porRef = Object.fromEntries(doEvento("parcela_lembrete").map((a) => [a.ref_id, a.resolvido_em ?? null]));
  assert.ok(porRef[P1], "o da paga sai");
  assert.equal(porRef[P2], null, "o da outra fica");
});

test("P8. nenhum dos dois eventos chega à faixa vermelha; a tabela das rotinas e a geral dizem o mesmo (uma fonte só)", () => {
  assert.equal(rotinas.EVENTO_DA_ROTINA?.lembreteParcelaAluguel, "parcela_lembrete");
  assert.equal(rotinas.EVENTO_DA_ROTINA?.pagamentoRegistradoMorador, "parcela_registrada");
  for (const [rotina, evento] of Object.entries(rotinas.EVENTO_DA_ROTINA ?? {})) {
    for (const [papel, papelAviso] of [["inquilino", "morador"], ["proprietario", "dono"]] as const) {
      assert.equal(prioridadeDoAviso(evento as never, papelAviso), rotinas.avisoDaRotina(rotina, papel).prioridade, `${evento} (${papelAviso}): as duas tabelas concordam`);
    }
  }
  for (const ev of ["parcela_lembrete", "parcela_registrada"]) for (const p of ["morador", "dono"] as const) assert.notEqual(prioridadeDoAviso(ev as never, p), "critico", `${ev} nunca crítico`);
  // O botão da faixa lê o EVENTO (já não o título).
  assert.equal(acaoDaFaixa("parcela_lembrete", "um título qualquer"), "Ver os pagamentos");
  assert.equal(acaoDaFaixa("parcela_registrada", null), "Ver os pagamentos");
});

test("P9. o e-mail dos dois: assunto, corpo e botão iguais aos de hoje; a categoria e os canais, os do evento do contrato", async () => {
  semear([parcela(P1, C1, VENCE)]);
  await rodarCobrancaMensal(admin as never, EM("2026-12-05"));
  await registrarPagamentoMensal(P1);
  const [lembrete, registro] = g.__e1247pEnvios as { event: string; subject: string; ctaLabel: string; body: (n?: string) => string; pushUrl: string }[];
  assert.equal(lembrete.event, "parcela_lembrete");
  assert.equal(lembrete.subject, ASSUNTOS.lembreteParcelaAluguel);
  assert.equal(lembrete.ctaLabel, "Ver a estadia");
  assert.equal(lembrete.body("Ana"), "Olá Ana, lembrete: a parcela de R$ 3.200,00 do aluguel vence em 10/12/2026. O pagamento é feito direto ao proprietário; depois, registre aqui para os dois acompanharem.");
  assert.equal(registro.event, "parcela_registrada");
  assert.equal(registro.subject, ASSUNTOS.pagamentoRegistradoMorador);
  assert.equal(registro.ctaLabel, "Ver o contrato");
  assert.equal(registro.body("Rui"), "Olá Rui, o morador registrou o pagamento de uma parcela do aluguel de Apto Centro. Confirme quando o valor chegar até você.");
  assert.equal(registro.pushUrl, `/dashboard/contratos/${C1}`);
  const M = MATRIZ_NOTIFICACOES as Record<string, { categoria: string }>;
  for (const [ev, papel] of [["parcela_lembrete", "morador"], ["parcela_registrada", "proprietario"]] as const) {
    assert.equal(M[ev]?.categoria, M.contract_status.categoria, `${ev}: a mesma categoria (o interruptor de hoje)`);
    assert.deepEqual(canaisDoEvento(ev as never, papel), canaisDoEvento("contract_status", papel), `${ev}: os mesmos canais`);
    assert.ok((TEMPLATES as Record<string, { subject: string }>)[ev], `${ev} no catálogo`);
  }
});

test("P10. o aviso de assinar do mesmo contrato não é tocado por nenhuma destas ações", async () => {
  semear([parcela(P1, C1, VENCE)]);
  banco.avisos.push({ id: "assinar", usuario_id: MORADOR, evento: "contract_status", ref_id: C1, titulo: "Assinar o contrato", prioridade: "critico", lido_em: null, resolvido_em: null, criado_em: "2026-12-01T00:00:00.000Z" });
  banco.avisos.push({ id: "assinar-dono", usuario_id: DONO, evento: "contract_status", ref_id: C1, titulo: "Assinar o contrato", prioridade: "critico", lido_em: null, resolvido_em: null, criado_em: "2026-12-01T00:00:00.000Z" });
  await rodarCobrancaMensal(admin as never, EM("2026-12-05"));
  await registrarPagamentoMensal(P1);
  g.__e1247pSessao = sessao(DONO);
  await confirmarPagamentoMensal(P1);
  await rodarCobrancaMensal(admin as never, EM("2026-12-12"));
  for (const id of ["assinar", "assinar-dono"]) assert.equal(banco.avisos.find((a) => a.id === id)?.resolvido_em ?? null, null, id);
});

test("D4. a decisão 4: a parcela vence sem pagamento → a rotina resolve o lembrete; no dia do vencimento e antes, ele fica", async () => {
  semear([parcela(P1, C1, VENCE), parcela(P2, C2, "2026-12-14")]);
  await rodarCobrancaMensal(admin as never, EM("2026-12-05"));
  await rodarCobrancaMensal(admin as never, EM("2026-12-09")); // o D-5 da P2 (vence a 14/12)
  assert.equal(doEvento("parcela_lembrete").length, 2);
  // No dia do vencimento da P1 ("vence em breve" ainda é verdade): fica.
  await rodarCobrancaMensal(admin as never, EM("2026-12-10"));
  const de = (ref: string) => doEvento("parcela_lembrete").find((a) => a.ref_id === ref)!;
  assert.equal(de(P1).resolvido_em ?? null, null, "no dia do vencimento, fica");
  // Passado o vencimento, sem pagamento: sai. A P2 (por vencer) fica.
  await rodarCobrancaMensal(admin as never, EM("2026-12-11"));
  assert.ok(de(P1).resolvido_em, "vencida sem pagamento: resolvida pela rotina");
  assert.equal(de(P2).resolvido_em ?? null, null, "a que ainda não venceu fica");
  // Correr outra vez não muda nada.
  const quando = de(P1).resolvido_em;
  await rodarCobrancaMensal(admin as never, EM("2026-12-12"));
  assert.equal(de(P1).resolvido_em, quando, "idempotente");
});

test("E. estático: as duas chamadas dizem o evento próprio, o papel e a referência; as ações resolvem pela referência", () => {
  const rotina = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
  const acoes = readFileSync(new URL("./acoes.ts", import.meta.url), "utf8");
  assert.match(rotina, /event: EVENTO_DA_ROTINA\.lembreteParcelaAluguel[^\n]*refId: p\.id[^\n]*papelAviso: "morador"/);
  assert.match(acoes, /event: EVENTO_DA_ROTINA\.pagamentoRegistradoMorador[^\n]*refId: parcelaId[^\n]*papelAviso: "dono"/);
  assert.doesNotMatch(rotina + acoes, /event: "contract_status"/, "nenhum aviso da parcela com o evento do contrato");
});
