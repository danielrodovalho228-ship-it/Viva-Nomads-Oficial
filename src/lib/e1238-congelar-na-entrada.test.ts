/*
  E1238 — a correção da ORDEM-DUET 1269 (o coordenador não conferiu o diff: duas divergências).
   (D1) a entrada SEM hora conta das 23:59 do dia da entrada, pela mesma constante da saída (HORA_SEM_HORARIO);
   (D2) a conferência nasce a qualquer momento, mas com prazo_em NULO; o prazo congela NO MOMENTO DA ENTRADA (quando
        agora passa a âncora calculada com a hora vigente das instruções), com update … where prazo_em is null — pela
        rotina (automacoes) ou pela primeira leitura depois da âncora, o que vier primeiro. A saída segue a mesma regra.
   A leitura: com prazo_em gravado, vale o gravado; sem ele, o cálculo vivo pela hora actual das instruções.
  As travas correm as funções de verdade contra um falso FIEL (devolve só as colunas pedidas e aplica os filtros do
  update, incluindo o "is null"); a prova executada no Postgres (t1805) corre o mesmo update.
  Roda: node --test src/lib/e1238-congelar-na-entrada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as conf from "./conferencia.ts";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";

type Datas = conf.EntradaDoContrato;
type Gravado = { entrada: string | null; saida: string | null };
const c = conf as unknown as {
  HORA_SEM_HORARIO?: string;
  HORA_SAIDA_SEM_HORARIO?: string;
  ancoraConferencia?: (tipo: conf.TipoConferencia, datas: Datas | null) => Date | null;
  prazoACongelar?: (tipo: conf.TipoConferencia, datas: Datas | null, gravado: string | null, agora: Date) => Date | null;
};
const j = (await import("./data/janela-conferencia.ts")) as unknown as {
  abrirConferencia?: (admin: unknown, p: { contratoId: string; tipo: conf.TipoConferencia; abertaPor: string }) => unknown;
  congelarJanelaDeConferencia?: unknown;
  janelaVigente?: (admin: unknown, contratoId: string, blocos: { inicio: string | null; fim: string | null; status?: string | null }[], agora?: Date) => Promise<{ hora: string | null; gravado: Gravado; datas: Datas }>;
  congelarAbertasNaAncora?: (admin: unknown, linhas: { contrato_id: string; tipo: conf.TipoConferencia; prazo_em: string | null; datas: Datas }[], agora: Date) => Promise<Map<string, string | null>>;
};
const ler = (rel: string) => fonteSemComentarios(readFileSync(new URL(rel, import.meta.url), "utf8"));

const CONTRATO = "11111111-2222-4333-8444-555555555555";
const BLOCOS = [{ inicio: "2026-12-01", fim: "2027-01-30", status: "ativo" }];
// 01/12 14:00 BRT = 17:00Z; +48 h = 03/12 17:00Z. 01/12 23:59 BRT = 02/12 02:59Z; +48 h = 04/12 02:59Z.
const PRAZO_14H = "2026-12-03T17:00:00.000Z";
const PRAZO_SEM_HORA = "2026-12-04T02:59:00.000Z";

/** Falso FIEL do cliente admin: conferencias e contratos_checkin em memória; devolve só as colunas pedidas. */
function falso(inicial: { conferencias?: Record<string, unknown>[]; checkin?: Record<string, unknown>[] } = {}) {
  const tabelas: Record<string, Record<string, unknown>[]> = { conferencias: [...(inicial.conferencias ?? [])], contratos_checkin: [...(inicial.checkin ?? [])] };
  const updates: Record<string, unknown>[] = [];
  const upserts: { linha: Record<string, unknown>; opcoes: unknown }[] = [];
  const projetar = (cols: string, r: Record<string, unknown>) => Object.fromEntries(cols.split(",").map((s) => s.trim()).map((k) => [k, r[k] ?? null]));
  const from = (tabela: string) => {
    const filtros: ((r: Record<string, unknown>) => boolean)[] = [];
    let cols = "*";
    let mudar: Record<string, unknown> | null = null;
    const linhas = () => tabelas[tabela].filter((r) => filtros.every((f) => f(r)));
    const b: Record<string, unknown> = {
      select: (s: string) => ((cols = s), b),
      in: (k: string, v: unknown[]) => (filtros.push((r) => v.includes(r[k])), b),
      eq: (k: string, v: unknown) => (filtros.push((r) => r[k] === v), b),
      is: (k: string, v: null) => (filtros.push((r) => (r[k] ?? null) === v), b),
      update: (v: Record<string, unknown>) => ((mudar = v), b),
      upsert: (linha: Record<string, unknown>, opcoes: { ignoreDuplicates?: boolean }) => {
        upserts.push({ linha, opcoes });
        const ja = tabelas[tabela].find((r) => r.contrato_id === linha.contrato_id && r.tipo === linha.tipo);
        if (!ja) tabelas[tabela].push({ prazo_em: null, fechada_em: null, ...linha });
        return b;
      },
      maybeSingle: async () => ({ data: linhas()[0] ? projetar(cols, linhas()[0]) : null, error: null }),
      then: (ok: (v: unknown) => unknown) => {
        if (mudar) {
          const alvo = linhas();
          updates.push({ ...mudar, linhas: alvo.length });
          for (const r of alvo) Object.assign(r, mudar);
          return Promise.resolve({ data: null, error: null }).then(ok);
        }
        return Promise.resolve({ data: cols === "*" ? linhas() : linhas().map((r) => projetar(cols, r)), error: null }).then(ok);
      },
    };
    return b;
  };
  return { admin: { from }, tabelas, updates, upserts };
}

test("D1. uma constante para as duas: HORA_SEM_HORARIO = 23:59; a entrada sem hora conta das 23:59 do dia da entrada", () => {
  assert.equal(c.HORA_SEM_HORARIO, "23:59");
  assert.equal(c.HORA_SAIDA_SEM_HORARIO, undefined, "não fica uma segunda constante só da saída");
  assert.equal(conf.prazoConferenciaEntrada({ inicio: "2026-12-01", checkinAfter: null })?.toISOString(), PRAZO_SEM_HORA, "sem hora: 23:59 + 48 h (nunca 00:00 + 48 h = 34 h depois de quem chega à tarde)");
  assert.equal(conf.prazoConferenciaEntrada({ inicio: "2026-12-01", checkinAfter: "  " })?.toISOString(), PRAZO_SEM_HORA, "hora em branco = sem hora");
  assert.equal(conf.prazoConferenciaEntrada({ inicio: "2026-12-01", checkinAfter: "14:00" })?.toISOString(), PRAZO_14H);
  assert.equal(conf.prazoConferenciaSaida({ fim: "2027-01-30", checkoutBefore: null })?.toISOString(), "2027-02-03T02:59:00.000Z", "a saída, pela mesma constante");
  const fonte = ler("./conferencia.ts");
  const ancora = fonte.slice(fonte.indexOf("export function ancoraConferencia("), fonte.indexOf("export function prazoConferencia("));
  assert.match(ancora, /HORA_ENTRADA\.test\(hora\) \? hora : HORA_SEM_HORARIO\)/, "a âncora lê a constante única");
  assert.doesNotMatch(ancora, /"00:00"/, "nenhuma âncora conta da meia-noite");
  assert.match(fonte, /prazoConferenciaEntrada[\s\S]*?ancoraConferencia\("entrada"/, "o prazo da entrada sai da âncora");
  assert.match(fonte, /prazoConferenciaSaida[\s\S]*?ancoraConferencia\("saida"/, "o prazo da saída sai da âncora");
});

test("D2a. a âncora e o prazo a congelar: só depois da âncora, só sem prazo gravado", () => {
  assert.equal(typeof c.ancoraConferencia, "function");
  assert.equal(typeof c.prazoACongelar, "function");
  const d = { inicio: "2026-12-01", checkinAfter: "14:00", fim: "2027-01-30", checkoutBefore: null };
  assert.equal(c.ancoraConferencia!("entrada", d)?.toISOString(), "2026-12-01T17:00:00.000Z");
  assert.equal(c.ancoraConferencia!("saida", d)?.toISOString(), "2027-02-01T02:59:00.000Z", "saída: 31/01 23:59 BRT (sem hora de saída)");
  assert.equal(c.prazoACongelar!("entrada", d, null, new Date("2026-12-01T16:59:00Z")), null, "antes da âncora, não congela");
  assert.equal(c.prazoACongelar!("entrada", d, null, new Date("2026-12-01T17:00:00Z"))?.toISOString(), PRAZO_14H, "na âncora, congela");
  assert.equal(c.prazoACongelar!("entrada", d, "2026-12-03T03:00:00.000Z", new Date("2026-12-02T00:00:00Z")), null, "já gravado: não toca");
});

test("D2b. a conferência criada antes da entrada nasce com prazo_em NULO (abrir não grava prazo)", () => {
  assert.equal(typeof j.abrirConferencia, "function");
  assert.equal(j.congelarJanelaDeConferencia, undefined, "o nome velho, que gravava o prazo na criação, sai");
  const f = falso();
  j.abrirConferencia!(f.admin, { contratoId: CONTRATO, tipo: "entrada", abertaPor: "u1" });
  assert.deepEqual(f.upserts, [{ linha: { contrato_id: CONTRATO, tipo: "entrada", aberta_por: "u1" }, opcoes: { onConflict: "contrato_id,tipo", ignoreDuplicates: true } }]);
  assert.equal(f.tabelas.conferencias[0].prazo_em, null);
  const acoes = ler("./data/conferencia-actions.ts");
  assert.equal((acoes.match(/abrirConferencia\(admin, \{ contratoId[^}]*\}\)/g) ?? []).length, 4, "os quatro pontos de abertura abrem sem prazo");
  assert.doesNotMatch(acoes, /prazo_em/, "nenhuma ação grava o prazo à mão");
  assert.doesNotMatch(ler("./data/contrato-assinar-actions.ts"), /prazo_em|abrirConferencia|from\("conferencias"\)\s*\.(upsert|insert)/, "a assinatura não grava prazo");
});

test("D2c. o caso real: assina sem hora, o dono põe 14:00 depois — o prazo fica 48 h depois das 14:00", async () => {
  assert.equal(typeof j.janelaVigente, "function");
  const f = falso({ conferencias: [{ contrato_id: CONTRATO, tipo: "entrada", prazo_em: null, fechada_em: null }] });
  // Semanas antes da entrada, sem hora: nada congela; o cálculo vivo dá 23:59.
  let v = await j.janelaVigente!(f.admin, CONTRATO, BLOCOS, new Date("2026-11-10T12:00:00Z"));
  assert.equal(v.gravado.entrada, null);
  assert.equal(conf.prazoDaJanela("entrada", v.datas, v.gravado.entrada)?.toISOString(), PRAZO_SEM_HORA);
  assert.equal(f.updates.length, 0, "antes da entrada, nenhum update");
  // O dono põe 14:00 nas instruções; na entrada, a primeira leitura depois das 14:00 congela.
  f.tabelas.contratos_checkin.push({ contrato_id: CONTRATO, horario: "14:00" });
  v = await j.janelaVigente!(f.admin, CONTRATO, BLOCOS, new Date("2026-12-01T17:05:00Z"));
  assert.equal(v.gravado.entrada, PRAZO_14H, "48 h depois das 14:00 — não das 00:00 nem das 23:59");
  assert.equal(f.tabelas.conferencias[0].prazo_em, PRAZO_14H);
});

test("D2d. sem hora até à entrada: congela 48 h depois das 23:59", async () => {
  const f = falso({ conferencias: [{ contrato_id: CONTRATO, tipo: "entrada", prazo_em: null, fechada_em: null }] });
  const v1 = await j.janelaVigente!(f.admin, CONTRATO, BLOCOS, new Date("2026-12-01T20:00:00Z"));
  assert.equal(v1.gravado.entrada, null, "às 17:00 BRT do dia da entrada, sem hora, a âncora (23:59) ainda não chegou");
  const v2 = await j.janelaVigente!(f.admin, CONTRATO, BLOCOS, new Date("2026-12-02T03:00:00Z"));
  assert.equal(v2.gravado.entrada, PRAZO_SEM_HORA);
});

test("D2e. a hora editada depois do congelamento não move o prazo", async () => {
  const f = falso({ conferencias: [{ contrato_id: CONTRATO, tipo: "entrada", prazo_em: null, fechada_em: null }], checkin: [{ contrato_id: CONTRATO, horario: "14:00" }] });
  await j.janelaVigente!(f.admin, CONTRATO, BLOCOS, new Date("2026-12-01T18:00:00Z"));
  f.tabelas.contratos_checkin[0].horario = "20:00";
  const v = await j.janelaVigente!(f.admin, CONTRATO, BLOCOS, new Date("2026-12-02T12:00:00Z"));
  assert.equal(v.gravado.entrada, PRAZO_14H);
  assert.equal(conf.prazoDaJanela("entrada", v.datas, v.gravado.entrada)?.toISOString(), PRAZO_14H, "a leitura vale o gravado");
  assert.equal(f.updates.length, 1, "um só update");
});

test("D2f. a rotina grava o prazo uma vez; rodar de novo não muda nada; a fechada não é tocada; a saída segue a regra", async () => {
  assert.equal(typeof j.congelarAbertasNaAncora, "function");
  const datas = { inicio: "2026-12-01", checkinAfter: "14:00", fim: "2027-01-30", checkoutBefore: null };
  const f = falso({
    conferencias: [
      { contrato_id: CONTRATO, tipo: "entrada", prazo_em: null, fechada_em: null },
      { contrato_id: CONTRATO, tipo: "saida", prazo_em: null, fechada_em: null },
    ],
  });
  const linhas = () => f.tabelas.conferencias.map((r) => ({ contrato_id: CONTRATO, tipo: r.tipo as conf.TipoConferencia, prazo_em: (r.prazo_em as string | null) ?? null, datas }));
  const agora = new Date("2026-12-02T12:00:00Z");
  const m1 = await j.congelarAbertasNaAncora!(f.admin, linhas(), agora);
  assert.equal(m1.get(`${CONTRATO}:entrada`), PRAZO_14H);
  assert.equal(m1.get(`${CONTRATO}:saida`), null, "a saída ainda não chegou à âncora dela");
  const m2 = await j.congelarAbertasNaAncora!(f.admin, linhas(), new Date("2026-12-02T13:00:00Z"));
  assert.equal(m2.get(`${CONTRATO}:entrada`), PRAZO_14H);
  assert.equal(f.updates.length, 1, "rodar de novo não escreve");
  assert.deepEqual(f.updates[0], { prazo_em: PRAZO_14H, linhas: 1 });
  // A saída: depois de 31/01 23:59 BRT congela 48 h depois.
  const m3 = await j.congelarAbertasNaAncora!(f.admin, linhas(), new Date("2027-02-01T03:00:00Z"));
  assert.equal(m3.get(`${CONTRATO}:saida`), "2027-02-03T02:59:00.000Z");
  // A fechada não recebe prazo: o update filtra fechada_em is null.
  const g = falso({ conferencias: [{ contrato_id: CONTRATO, tipo: "entrada", prazo_em: null, fechada_em: "2026-12-01T00:00:00Z" }] });
  await j.congelarAbertasNaAncora!(g.admin, [{ contrato_id: CONTRATO, tipo: "entrada", prazo_em: null, datas }], agora);
  assert.equal(g.tabelas.conferencias[0].prazo_em, null);
});

test("D2g. quem congela: a rotina (automacoes) e a leitura (os leitores passam pela janelaVigente)", () => {
  const rota = ler("../app/api/cron/automacoes/route.ts");
  const fechar = rota.slice(rota.indexOf("async function fecharConferenciasVencidas("), rota.indexOf("async function fecharConferenciasVencidas(") + 2500);
  assert.match(fechar, /congelarAbertasNaAncora\(admin, /, "a rotina congela antes de fechar");
  assert.match(ler("./data/conferencia-actions.ts"), /janelaVigente\(admin, contratoId, /, "A — servidor e secção");
  assert.match(ler("./data/estadia.ts"), /janelaVigente\(admin, c\.id, /, "C — a estadia");
  assert.match(ler("./data/contrato-assinar-actions.ts"), /janelaVigente\(/, "B — o contrato");
});
