/*
  E1240 — a hora de SAÍDA das instruções (ESPEC-E1240 v5; ORDEM-DUET 1324). Fatia 1: o campo "Horário de saída
  (opcional)" no formulário do dono, a regra única da âncora aplicada à saída, e a adoção pela âncora da conferência de
  saída. O morador não vê a hora de saída nesta fatia (ORDEM-1288), embora ela mova a âncora da conferência dele.
  - S (secção 5.2): a regra única dos DOIS lados, pela função pura e pela ação REAL (checkin-actions.ts) com o banco
    falso (src/lib/data/e1240-checkin-harness): "Nenhuma edição de horário pode pôr a âncora no passado."
  - A (secção 5.3): a âncora da conferência de saída lê a hora gravada; sem ela, 23:59, como no E1238.
  - V: a validação e a gravação do campo — ausente não toca, vazio apaga, fora do formato recusa.
  Roda: node --test src/lib/e1240-hora-de-saida.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as conf from "./conferencia.ts";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";

register("./data/e1240-checkin-harness/loader.mjs", import.meta.url);

type Blocos = { inicio: string | null; fim: string | null; status?: string | null }[];
type Recusa = (p: { blocos: Blocos; horaAtual: string | null; horaNova: string | null | undefined; agora: Date }) => string | null;
const j = (await import("./data/janela-conferencia.ts")) as unknown as {
  MSG_HORA_DE_ENTRADA_BLOQUEADA: string;
  MSG_HORA_DE_ENTRADA_NO_PASSADO: string;
  recusaDaHoraDeEntrada: Recusa;
  MSG_HORA_DE_SAIDA_BLOQUEADA?: string;
  MSG_HORA_DE_SAIDA_NO_PASSADO?: string;
  recusaDaHoraDeSaida?: Recusa;
  datasDaJanela: (b: Blocos, hora: string | null, horaSaida?: string | null) => conf.EntradaDoContrato;
  janelaVigente: (admin: unknown, id: string, b: Blocos, agora?: Date) => Promise<{ hora: string | null; horaSaida?: string | null; gravado: { entrada: string | null; saida: string | null }; datas: conf.EntradaDoContrato }>;
  janelaDoContrato: (admin: unknown, id: string) => Promise<{ hora: string | null; horaSaida?: string | null }>;
};
const checkin = (await import("./checkin.ts")) as unknown as {
  validarInstrucoes: (e: Record<string, unknown>) => { ok: true; dados: { horario: string; instrucoes: string; plantao: string }; horaSaida?: string | null } | { ok: false; erro: string };
};
const acoes = (await import("./data/checkin-actions.ts")) as unknown as {
  salvarInstrucoesEntrada: (i: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>;
  instrucoesDoContrato: (id: string) => Promise<{ papel: string; horaSaida?: string | null; dados: unknown } | null>;
};
const ler = (rel: string) => fonteSemComentarios(readFileSync(new URL(rel, import.meta.url), "utf8"));

const BLOCOS: Blocos = [{ inicio: "2026-12-01", fim: "2027-01-30", status: "ativo" }];
const MIN = 60_000;
/** O instante de Brasília no DIA da entrada ou da saída, à hora dada (a partir da âncora sem hora, 23:59, da regra). */
const noDia = (tipo: "entrada" | "saida", hhmm: string) => {
  const base = conf.ancoraConferencia(tipo, j.datasDaJanela(BLOCOS, null, null))!; // 23:59 do dia
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(base.getTime() + (h * 60 + m - (23 * 60 + 59)) * MIN);
};

// ——— os dois lados da regra ———
const LADOS = [
  { nome: "entrada", tipo: "entrada" as const, recusa: () => j.recusaDaHoraDeEntrada, m1: () => j.MSG_HORA_DE_ENTRADA_BLOQUEADA, m2: () => j.MSG_HORA_DE_ENTRADA_NO_PASSADO },
  { nome: "saída", tipo: "saida" as const, recusa: () => j.recusaDaHoraDeSaida!, m1: () => j.MSG_HORA_DE_SAIDA_BLOQUEADA, m2: () => j.MSG_HORA_DE_SAIDA_NO_PASSADO },
];

test("S1. as mensagens da saída, nas palavras decididas (ORDENS 1285, 1291 e 1324); a irmã existe", () => {
  assert.equal(j.MSG_HORA_DE_SAIDA_BLOQUEADA, "A saída já aconteceu; o horário não pode mais ser alterado.");
  assert.equal(j.MSG_HORA_DE_SAIDA_NO_PASSADO, "Esse horário de saída já passou; informe um horário a partir de agora.");
  assert.equal(typeof j.recusaDaHoraDeSaida, "function");
  assert.equal(j.MSG_HORA_DE_ENTRADA_BLOQUEADA, "A entrada já aconteceu; o horário não pode mais ser alterado.");
  assert.equal(j.MSG_HORA_DE_ENTRADA_NO_PASSADO, "Esse horário de entrada já passou; informe um horário a partir de agora.");
});

for (const L of LADOS) {
  const R = (horaAtual: string | null, horaNova: string | null | undefined, agora: Date) => L.recusa()({ blocos: BLOCOS, horaAtual, horaNova, agora });
  const dia = (hhmm: string) => noDia(L.tipo, hhmm);

  test(`S2 (${L.nome}). num dia anterior, qualquer hora é aceite`, () => {
    const antes = new Date(dia("15:00").getTime() - 2 * 24 * 60 * MIN);
    for (const h of ["00:00", "11:00", "18:00", "23:59"]) assert.equal(R(null, h, antes), null, h);
    assert.equal(R("18:00", "08:00", antes), null, "mudar também");
  });
  test(`S3 (${L.nome}). no dia, às 15:00, sem hora gravada, gravar 11:00 → segunda mensagem; a âncora continua 23:59`, () => {
    assert.equal(R(null, "11:00", dia("15:00")), L.m2());
  });
  test(`S4 (${L.nome}). no dia, às 15:00, gravar 18:00 → aceite`, () => {
    assert.equal(R(null, "18:00", dia("15:00")), null);
  });
  test(`S5 (${L.nome}). no dia, às 15:00, com 18:00 gravada, gravar 11:00 → segunda mensagem`, () => {
    assert.equal(R("18:00", "11:00", dia("15:00")), L.m2());
  });
  test(`S6 (${L.nome}). depois da âncora vigente (11:00 gravada, são 15:00), gravar 18:00 → PRIMEIRA mensagem`, () => {
    assert.equal(R("11:00", "18:00", dia("15:00")), L.m1());
  });
  test(`S7 (${L.nome}). a mesma hora não é mudança, mesmo depois da âncora`, () => {
    assert.equal(R("11:00", "11:00", dia("15:00")), null);
    assert.equal(R("11:00", " 11:00 ", dia("15:00")), null, "espaços não contam");
  });
  test(`S10 (${L.nome}). a fronteira: a âncora nova é exatamente agora → aceite`, () => {
    assert.equal(R(null, "15:00", dia("15:00")), null);
  });
  test(`S10b (${L.nome}). o minuto corrente segue a letra: às 15:00:30, gravar 15:00 → segunda mensagem`, () => {
    assert.equal(R(null, "15:00", new Date(dia("15:00").getTime() + 30_000)), L.m2());
  });
  test(`S11 (${L.nome}). a fronteira: agora é exatamente a âncora vigente → primeira mensagem`, () => {
    assert.equal(R("18:00", "19:00", dia("18:00")), L.m1());
  });
  test(`S14 (${L.nome}). nunca preencheu, e já passou das 23:59 do dia → primeira mensagem`, () => {
    assert.equal(R(null, "10:00", new Date(dia("23:59").getTime() + 60 * MIN)), L.m1());
  });
}

test("S12 (saída). o campo ausente nunca é recusado, antes e depois da âncora", () => {
  const R = j.recusaDaHoraDeSaida!;
  assert.equal(R({ blocos: BLOCOS, horaAtual: "11:00", horaNova: undefined, agora: noDia("saida", "15:00") }), null, "depois da âncora");
  assert.equal(R({ blocos: BLOCOS, horaAtual: null, horaNova: undefined, agora: new Date(noDia("saida", "23:59").getTime() + 60 * MIN) }), null, "depois das 23:59");
  assert.equal(R({ blocos: BLOCOS, horaAtual: "18:00", horaNova: undefined, agora: noDia("saida", "15:00") }), null, "antes da âncora");
});

test("S13 (saída). apagar a hora: antes da âncora vigente é sempre aceite (volta às 23:59); depois, primeira mensagem", () => {
  const R = j.recusaDaHoraDeSaida!;
  assert.equal(R({ blocos: BLOCOS, horaAtual: "18:00", horaNova: "", agora: noDia("saida", "15:00") }), null, "18:00 gravada, são 15:00");
  assert.equal(R({ blocos: BLOCOS, horaAtual: "18:00", horaNova: null, agora: noDia("saida", "17:59") }), null, "um minuto antes");
  assert.equal(R({ blocos: BLOCOS, horaAtual: "11:00", horaNova: "", agora: noDia("saida", "15:00") }), j.MSG_HORA_DE_SAIDA_BLOQUEADA, "11:00 gravada, são 15:00");
  assert.equal(R({ blocos: BLOCOS, horaAtual: null, horaNova: "", agora: noDia("saida", "15:00") }), null, "vazio sobre vazio não é mudança");
});

// ——— a adoção (A) ———
test("A1. com hora de saída 11:00, o prazo é o dia da saída às 11:00, mais 48 h", () => {
  const datas = j.datasDaJanela(BLOCOS, null, "11:00");
  assert.equal(datas.checkoutBefore, "11:00");
  assert.equal(conf.prazoDaJanela("saida", datas, null)?.toISOString(), new Date(noDia("saida", "11:00").getTime() + 48 * 60 * MIN).toISOString());
});
test("A2. sem hora de saída, 23:59 do dia da saída mais 48 h — igual ao E1238", () => {
  const datas = j.datasDaJanela(BLOCOS, "14:00");
  assert.equal(datas.checkoutBefore ?? null, null);
  assert.equal(conf.prazoDaJanela("saida", datas, null)?.toISOString(), new Date(noDia("saida", "23:59").getTime() + 48 * 60 * MIN).toISOString());
});

// ——— o banco falso, fiel: devolve só as colunas que o select pede ———
type Linha = Record<string, unknown>;
type Banco = { contratos: Linha[]; contratos_checkin: Linha[]; conferencias: Linha[] };
let banco: Banco;
let escritas: { tabela: string; op: string; valor: Linha }[];
let falhaHoraSaida = false;
const DONO = "00000000-0000-4000-8000-000000000001";
const MORADOR = "00000000-0000-4000-8000-000000000002";
const CONTRATO = "00000000-0000-4000-8000-0000000000c1";
const colunasDoSelect = (s: string) => s.split(",").map((c) => c.trim()).filter(Boolean);
function deTabela(tabela: keyof Banco) {
  let filtros: ((l: Linha) => boolean)[] = [];
  let cols: string[] | null = null;
  const projetar = (l: Linha) => {
    if (!cols || cols.includes("*")) return { ...l };
    const o: Linha = {};
    for (const c of cols) {
      const nome = c.split("(")[0];
      o[nome] = l[nome];
    }
    return o;
  };
  const resultado = () => {
    if (tabela === "contratos_checkin" && cols?.includes("horario_saida") && falhaHoraSaida) return { data: null, error: { code: "42703", message: "column horario_saida does not exist" } };
    return { data: banco[tabela].filter((l) => filtros.every((f) => f(l))).map(projetar), error: null };
  };
  const q = {
    select(s: string) {
      cols = colunasDoSelect(s);
      return q;
    },
    eq(c: string, v: unknown) {
      filtros.push((l) => l[c] === v);
      return q;
    },
    in(c: string, vs: unknown[]) {
      filtros.push((l) => vs.includes(l[c]));
      return q;
    },
    is(c: string, v: unknown) {
      filtros.push((l) => (l[c] ?? null) === v);
      return q;
    },
    async maybeSingle() {
      const r = resultado();
      return r.error ? r : { data: r.data?.[0] ?? null, error: null };
    },
    then(ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) {
      return Promise.resolve(resultado()).then(ok, ko);
    },
    upsert(valor: Linha) {
      escritas.push({ tabela, op: "upsert", valor });
      const atual = banco[tabela].find((l) => l.contrato_id === valor.contrato_id);
      if (atual) Object.assign(atual, valor);
      else banco[tabela].push({ ...valor });
      return Promise.resolve({ data: null, error: null });
    },
    update(valor: Linha) {
      const alvo = { filtros: [] as ((l: Linha) => boolean)[] };
      const u = {
        eq(c: string, v: unknown) {
          alvo.filtros.push((l) => l[c] === v);
          return u;
        },
        is(c: string, v: unknown) {
          alvo.filtros.push((l) => (l[c] ?? null) === v);
          return u;
        },
        then(ok: (r: unknown) => unknown) {
          escritas.push({ tabela, op: "update", valor });
          for (const l of banco[tabela].filter((x) => alvo.filtros.every((f) => f(x)))) Object.assign(l, valor);
          return Promise.resolve({ data: null, error: null }).then(ok);
        },
      };
      return u;
    },
  };
  filtros = [];
  return q;
}
const admin = { from: (t: keyof Banco) => deTabela(t) };
const sessao = (uid: string) => ({ auth: { getUser: async () => ({ data: { user: { id: uid } } }) } });
const g = globalThis as unknown as { __e1240Admin: unknown; __e1240Sessao: unknown };

function semear(checkin: Linha = {}) {
  banco = {
    contratos: [
      {
        id: CONTRATO,
        tenant_id: MORADOR,
        status: "ativo",
        assinado_proprietario_em: "2026-11-20T12:00:00Z",
        assinado_inquilino_em: "2026-11-20T12:00:00Z",
        properties: { owner_id: DONO },
        contrato_blocos: BLOCOS,
      },
    ],
    contratos_checkin: [{ contrato_id: CONTRATO, horario: "14:00", instrucoes: "Chave na portaria do prédio.", plantao: "34999990000", atualizado_em: null, horario_saida: null, ...checkin }],
    conferencias: [],
  };
  escritas = [];
  falhaHoraSaida = false;
  g.__e1240Admin = admin;
  g.__e1240Sessao = sessao(DONO);
}
beforeEach(() => semear());

const ENVIO = { contratoId: CONTRATO, horario: "14:00", instrucoes: "Chave na portaria do prédio.", plantao: "(34) 99999-0000" };
/** A ação real, com o relógio do servidor posto no instante dado. */
async function salvarEm(agora: Date, envio: Linha) {
  const RealDate = Date;
  const fixo = agora.getTime();
  class Relogio extends RealDate {
    constructor(...a: unknown[]) {
      if (a.length === 0) super(fixo);
      else super(...(a as [string]));
    }
    static now() {
      return fixo;
    }
  }
  globalThis.Date = Relogio as DateConstructor;
  try {
    return await acoes.salvarInstrucoesEntrada({ ...ENVIO, ...envio });
  } finally {
    globalThis.Date = RealDate;
  }
}
const gravada = () => banco.contratos_checkin[0];

test("V1. a validação: ausente = sem a chave; vazio = apagar (null); 11:00 = grava; fora do formato → a mensagem aprovada", () => {
  const base = { horario: "14:00", instrucoes: "Retire a chave no cofre.", plantao: "34999990000" };
  const ausente = checkin.validarInstrucoes(base);
  assert.ok(ausente.ok);
  assert.equal("horaSaida" in (ausente as object) && (ausente as { horaSaida?: unknown }).horaSaida !== undefined, false, "ausente fica ausente");
  const vazio = checkin.validarInstrucoes({ ...base, horaSaida: "  " });
  assert.ok(vazio.ok && vazio.horaSaida === null, "vazio apaga");
  const hora = checkin.validarInstrucoes({ ...base, horaSaida: " 11:00 " });
  assert.ok(hora.ok && hora.horaSaida === "11:00");
  for (const ruim of ["25:00", "11h", "11:00:00", "9:00"]) {
    const r = checkin.validarInstrucoes({ ...base, horaSaida: ruim });
    assert.deepEqual(r, { ok: false, erro: "Informe o horário de saída no formato 11:00." }, ruim);
  }
  assert.deepEqual((hora as { dados: unknown }).dados, { horario: "14:00", instrucoes: "Retire a chave no cofre.", plantao: "34999990000" }, "os três campos de hoje ficam iguais");
});

test("V2. a gravação: ausente não toca na coluna; vazio apaga; hora válida grava", async () => {
  semear({ horario_saida: "11:00" });
  const antes = new Date("2026-12-10T12:00:00Z");
  assert.deepEqual(await salvarEm(antes, { instrucoes: "Chave com o porteiro, sem pressa." }), { ok: true });
  assert.equal("horario_saida" in escritas[0].valor, false, "a página antiga (sem o campo) não escreve a coluna");
  assert.equal(gravada().horario_saida, "11:00", "a hora fica");
  assert.deepEqual(await salvarEm(antes, { horaSaida: "" }), { ok: true });
  assert.equal(gravada().horario_saida, null, "vazio apaga");
  assert.deepEqual(await salvarEm(antes, { horaSaida: "10:30" }), { ok: true });
  assert.equal(gravada().horario_saida, "10:30");
  const r = await salvarEm(antes, { horaSaida: "11h" });
  assert.deepEqual(r, { ok: false, error: "Informe o horário de saída no formato 11:00." });
  assert.equal(gravada().horario_saida, "10:30", "o formato recusado não grava");
});

test("V3. \"instruções preenchidas\" continua a ser os três campos de hoje: a hora de saída não conta", async () => {
  semear({ horario_saida: null });
  const dono = await acoes.instrucoesDoContrato(CONTRATO);
  assert.ok(dono?.dados, "preenchidas sem a hora de saída");
  semear({ instrucoes: null, horario_saida: "11:00" });
  const sem = (await acoes.instrucoesDoContrato(CONTRATO)) as { preenchidas?: boolean } | null;
  assert.equal(sem?.preenchidas, false, "com a hora de saída mas sem como entrar: não preenchidas");
});

test("V4. a leitura: o dono recebe a hora de saída para o formulário; o morador NÃO a recebe (ORDEM-1288), mesmo assinado", async () => {
  semear({ horario_saida: "11:00" });
  assert.equal((await acoes.instrucoesDoContrato(CONTRATO))?.horaSaida, "11:00", "o dono");
  g.__e1240Sessao = sessao(MORADOR);
  const morador = await acoes.instrucoesDoContrato(CONTRATO);
  assert.ok(morador?.dados, "o morador vê as instruções (assinado pelos dois)");
  assert.equal(morador?.horaSaida ?? null, null, "mas não a hora de saída");
  assert.doesNotMatch(JSON.stringify(morador), /11:00/, "nem escondida noutro campo");
});

test("S8. o servidor recusa ANTES de gravar: com a hora recusada, nem o texto, nem o plantão, nem a outra hora são gravados", async () => {
  // saída: 11:00 gravada, no dia da saída às 15:00, mudar para 18:00 e o texto junto.
  semear({ horario_saida: "11:00" });
  let r = await salvarEm(noDia("saida", "15:00"), { horaSaida: "18:00", instrucoes: "Texto novo que não pode entrar.", plantao: "(34) 98888-0000" });
  assert.deepEqual(r, { ok: false, error: j.MSG_HORA_DE_SAIDA_BLOQUEADA });
  assert.equal(escritas.length, 0, "saída: nada gravado");
  // entrada: no dia da entrada às 15:00, 14:00 gravada (já passou), mudar para 18:00, com a hora de saída nova junto.
  semear();
  r = await salvarEm(noDia("entrada", "15:00"), { horario: "18:00", horaSaida: "10:00", instrucoes: "Texto novo que não pode entrar." });
  assert.deepEqual(r, { ok: false, error: j.MSG_HORA_DE_ENTRADA_BLOQUEADA });
  assert.equal(escritas.length, 0, "entrada: nada gravado, nem a hora de saída");
});

test("S9. as duas horas no mesmo envio: uma recusada, nada gravado; confere-se primeiro a entrada", async () => {
  // As duas recusadas: a mensagem é a da entrada. Agora = no dia da SAÍDA às 15:00 (a entrada já passou há muito).
  semear({ horario_saida: "11:00" });
  let r = await salvarEm(noDia("saida", "15:00"), { horario: "16:00", horaSaida: "18:00" });
  assert.deepEqual(r, { ok: false, error: j.MSG_HORA_DE_ENTRADA_BLOQUEADA }, "as duas falham: a da entrada");
  assert.equal(escritas.length, 0);
  // Só a saída falha (a entrada igual não é mudança): a mensagem é a da saída.
  r = await salvarEm(noDia("saida", "15:00"), { horario: "14:00", horaSaida: "12:00" });
  assert.deepEqual(r, { ok: false, error: j.MSG_HORA_DE_SAIDA_BLOQUEADA }, "só a saída falha: a da saída");
  assert.equal(escritas.length, 0);
  // Antes da âncora da saída, uma hora já passada: a segunda mensagem da saída.
  semear({ horario_saida: null });
  r = await salvarEm(noDia("saida", "15:00"), { horaSaida: "11:00" });
  assert.deepEqual(r, { ok: false, error: j.MSG_HORA_DE_SAIDA_NO_PASSADO });
  assert.equal(escritas.length, 0);
});

test("S7 (ação). depois da âncora da saída, a mesma hora não é mudança: o texto e o plantão continuam editáveis", async () => {
  semear({ horario_saida: "11:00" });
  const r = await salvarEm(noDia("saida", "15:00"), { horaSaida: "11:00", instrucoes: "Deixe a chave na portaria ao sair." });
  assert.deepEqual(r, { ok: true });
  assert.equal(gravada().instrucoes, "Deixe a chave na portaria ao sair.");
  assert.equal(gravada().horario_saida, "11:00");
});

test("S12 (ação). o campo ausente, depois da âncora da saída: aceite, e a hora gravada não muda", async () => {
  semear({ horario_saida: "11:00" });
  assert.deepEqual(await salvarEm(noDia("saida", "15:00"), { instrucoes: "Só o texto, de uma página antiga." }), { ok: true });
  assert.equal(gravada().horario_saida, "11:00");
});

test("S13 (ação). apagar antes da âncora: aceite e apagada; depois da âncora: primeira mensagem, nada gravado", async () => {
  semear({ horario_saida: "18:00" });
  assert.deepEqual(await salvarEm(noDia("saida", "15:00"), { horaSaida: "" }), { ok: true });
  assert.equal(gravada().horario_saida, null);
  semear({ horario_saida: "11:00" });
  assert.deepEqual(await salvarEm(noDia("saida", "15:00"), { horaSaida: "" }), { ok: false, error: j.MSG_HORA_DE_SAIDA_BLOQUEADA });
  assert.equal(gravada().horario_saida, "11:00");
});

test("S15. depois da entrada e antes da saída, com a hora de entrada igual: mudar a hora de saída para uma hora por vir é aceite", async () => {
  semear({ horario_saida: "11:00" });
  assert.deepEqual(await salvarEm(new Date("2026-12-15T15:00:00Z"), { horario: "14:00", horaSaida: "10:00" }), { ok: true });
  assert.equal(gravada().horario_saida, "10:00");
  assert.equal(gravada().horario, "14:00");
});

test("A3. a janela lê a hora de saída gravada; a conferência de saída aberta sem prazo congela pela hora nova", async () => {
  semear({ horario_saida: "11:00" });
  banco.conferencias.push({ contrato_id: CONTRATO, tipo: "saida", prazo_em: null, fechada_em: null });
  const vig = await j.janelaVigente(admin, CONTRATO, BLOCOS, noDia("saida", "12:00"));
  assert.equal(vig.horaSaida, "11:00");
  assert.equal(vig.datas.checkoutBefore, "11:00");
  assert.equal(vig.gravado.saida, new Date(noDia("saida", "11:00").getTime() + 48 * 60 * MIN).toISOString(), "congela pela hora de saída gravada, não pelas 23:59");
});

test("A4. com o prazo de saída já gravado, a hora de saída não o muda", async () => {
  semear({ horario_saida: "08:00" });
  const gravado = "2027-02-02T20:00:00.000Z";
  banco.conferencias.push({ contrato_id: CONTRATO, tipo: "saida", prazo_em: gravado, fechada_em: null });
  const vig = await j.janelaVigente(admin, CONTRATO, BLOCOS, noDia("saida", "12:00"));
  assert.equal(vig.gravado.saida, gravado);
  assert.equal(conf.prazoDaJanela("saida", vig.datas, vig.gravado.saida)?.toISOString(), gravado);
});

test("A3b. a leitura da hora de saída é à parte: se falhar (a coluna ainda por aplicar), a hora de entrada segue lida e a saída cai nas 23:59", async () => {
  semear({ horario_saida: "11:00" });
  falhaHoraSaida = true;
  const jan = await j.janelaDoContrato(admin, CONTRATO);
  assert.equal(jan.hora, "14:00");
  assert.equal(jan.horaSaida ?? null, null);
});

test("A5 e A6. a rotina e a página do contrato montam as datas com a hora de saída da janela; a estadia lê pela janela vigente", () => {
  const rotina = ler("../app/api/cron/automacoes/route.ts");
  assert.match(rotina, /datasDaJanela\([^;]*janelas\.get\(c\.contrato_id\)\?\.horaSaida \?\? null\)/, "a rotina passa a hora de saída");
  const assinar = ler("./data/contrato-assinar-actions.ts");
  assert.match(assinar, /checkoutBefore: janela\?\.horaSaida \?\? null/, "a página do contrato usa a hora de saída da janela");
  assert.match(ler("./data/estadia.ts"), /janelaVigente\(admin, c\.id, blocosOrdenados\(c\)\)[\s\S]*prazoDaJanela\("saida", datas, janela\.gravado\.saida\)/, "a estadia lê pela janela vigente");
});

test("A7. estático: datasDaJanela já não entrega a saída sempre vazia; ninguém monta as datas da janela com a saída vazia à mão", () => {
  const fonte = ler("./data/janela-conferencia.ts");
  const datas = fonte.slice(fonte.indexOf("export function datasDaJanela("), fonte.indexOf("export async function horasDeEntrada("));
  assert.doesNotMatch(datas, /checkoutBefore: null/, "datasDaJanela devolve a hora de saída que recebe");
  assert.match(fonte, /const datas = datasDaJanela\(blocos, janela\.hora, janela\.horaSaida\);/, "a janela vigente passa a hora de saída");
  // As duas funções da ENTRADA montam as datas só para a âncora da entrada, que não lê a saída: aí a saída vazia é
  // legítima (nota da ESPEC à A7), e por isso só se procura a montagem à mão fora delas.
  const assinar = ler("./data/contrato-assinar-actions.ts");
  assert.doesNotMatch(assinar, /\{ inicio, checkinAfter: janela\?\.hora \?\? null, fim \}/, "a página do contrato já não monta as datas sem a saída");
});

test("V5. o formulário do dono: \"Horário de saída (opcional)\" logo abaixo do de entrada, sem ser obrigatório, enviado sempre; a linha do morador não muda", () => {
  const tela = ler("../components/contrato/checkin-contrato.tsx");
  const entrada = tela.indexOf('data-testid="checkin-horario"');
  const rotulo = tela.indexOf("Horário de saída (opcional)");
  const como = tela.indexOf("Como pegar a chave ou o acesso");
  assert.ok(entrada > 0 && rotulo > entrada && rotulo < como, "o rótulo aprovado, entre a hora de entrada e o como entrar");
  const campo = tela.slice(rotulo, tela.indexOf("</label>", rotulo));
  assert.match(campo, /type="time"/);
  assert.doesNotMatch(campo, /required/, "não é obrigatório");
  assert.match(campo, /data-testid="checkin-horario-saida"/);
  assert.match(tela, /salvarInstrucoesEntrada\(\{ contratoId, horario, instrucoes, plantao, horaSaida \}\)/, "o envio leva o campo (vazio = apagar)");
  const lidas = tela.slice(tela.indexOf('data-testid="checkin-instrucoes-lidas"'), tela.indexOf('data-testid="checkin-pendente"'));
  assert.doesNotMatch(lidas, /horaSaida|saída/i, "a linha que o morador lê não mostra a hora de saída nesta fatia");
});
