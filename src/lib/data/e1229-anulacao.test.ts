/*
  E1229 — a anulação de registros de pagamento (aluguel e caução), pelo desenho do coordenador (ORDENS-DUET 1143, 1160
  e 1162). Antes: não havia anulação pela tela (só por migração, nas duplicidades da 0182/0295).
   - Quem anula: o DONO, e sozinho só ANTES da confirmação do morador. Depois da confirmação, a ação dele é recusada e
     vira PEDIDO à Central: um chamado que nasce do registro (o número REC/CAU, o valor e o motivo), na fila de quem trata
     desse dinheiro — aluguel → "cobranca" (Financeiro), caução → "caucao" (Manutenção e Caução).
   - A Central decide: só a equipe, com a mesma anulação, e recusa o que já está anulado (dois cliques, uma anulação).
   - O motivo é obrigatório (5 letras ou mais) e vai para o morador: "O proprietário anulou o registro {REC} de {R$}: {motivo}".
   - O documento ligado (REC/CAU) é anulado junto (o PDF guardado nunca é apagado).
   - Quem anulou fica na trilha do contrato (contrato_eventos, tipo "pagamento_anulado", 0368): o caminho "dono" ou
     "central" (com o número do chamado), o pagamento, o documento, o valor e o motivo.
  ORDEM-DUET-1169 (correção B do coordenador): a anulação é UMA operação no banco — anular_pagamento (0368), numa
  transação só: o pagamento (com as guardas), o documento e o evento; ou tudo, ou nada. A ação chama-a uma vez e só
  avisa depois de ela dar certo. No caminho da Central, o aviso diz que foi a equipe, a pedido do proprietário, e o dono
  recebe a decisão numa resposta VISÍVEL no chamado dele (a nota interna fica para a equipe).
  Corre as ações REAIS com o Supabase falso (harness ./e1229-harness/loader.mjs).
  Roda: node --test src/lib/data/e1229-anulacao.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

register("./e1229-harness/loader.mjs", import.meta.url);
const { anularRegistro, anularRegistroPelaCentral } = await import("./anulacao-actions.ts");

const DONO = "00000000-0000-4000-8000-00000000d0e0";
const MORADOR = "00000000-0000-4000-8000-00000000a0a0";
const EQUIPE = "00000000-0000-4000-8000-00000000e0e0";
const OUTRO = "00000000-0000-4000-8000-0000000000ff";
const CONTRATO = "11111111-2222-4333-8444-555555555555";
const PG = "22222222-3333-4444-8555-666666666666";
const CHAMADO = "33333333-4444-4555-8666-777777777777";
const MOTIVO = "registro em duplicidade";

type Pg = { id: string; contrato_id: string; bloco_id: string | null; tipo: string; parte: number; valor: number; encargos?: { rotulo: string; valor: number }[]; confirmado_pelo_inquilino: boolean; anulado_em: string | null };
type Estado = {
  pg: Pg;
  doc: { id: string; numero: string; anulado_em: string | null } | null;
  notaDoChamado: string | null;
  /** Quem escreveu a nota e se é interna (a do pedido é do sistema, interna). */
  notaAutor: string;
  notaInterna: boolean;
  /** Outras notas do chamado (ORDEM-DUET-1177: mais de um registro). */
  notasExtra: { corpo: string; autor: string; interno: boolean }[];
  /** O contexto do chamado (o pedido nasce com o contrato do registro). */
  contexto: { tipo: string | null; id: string | null };
  updates: { tabela: string; valores: Record<string, unknown>; filtros: Record<string, unknown> }[];
  inserts: { tabela: string; linha: Record<string, unknown> }[];
  rpcs: { nome: string; args: Record<string, unknown> }[];
  /** A função do banco falha (simula a falha de uma das escritas: nada muda). */
  rpcFalha: boolean;
  /** A função do banco devolve vazio (data null, sem erro). */
  rpcVazio: boolean;
};
let E: Estado;
const g = globalThis as unknown as { __e1229Sessao: unknown; __e1229Admin: unknown; __e1229EhEquipe: unknown; __e1229Chamados: unknown[]; __e1229Avisos: Record<string, unknown>[]; __e1229Respostas: { id: string; texto: string; interno: boolean }[] };

function consulta(tabela: string, comoSessao: boolean) {
  const filtros: Record<string, unknown> = {};
  let valores: Record<string, unknown> | null = null;
  const b: Record<string, unknown> = {};
  let limite: number | null = null;
  for (const m of ["select", "order", "in"]) b[m] = () => b;
  // ORDEM-DUET-1181 (H4): o .limit(n) corta as linhas, como no banco.
  b.limit = (n: number) => ((limite = n), b);
  b.eq = (k: string, v: unknown) => ((filtros[k] = v), b);
  b.is = (k: string, v: unknown) => ((filtros[`is:${k}`] = v), b);
  const linhaPg = () => ({ ...E.pg, contratos: { id: CONTRATO, tenant_id: MORADOR, property_id: "p1", properties: { owner_id: DONO, title: "Casa no Centro" } } });
  const ler = () => {
    if (tabela === "pagamentos_bloco") return { data: filtros.id === E.pg.id ? linhaPg() : null, error: null };
    if (tabela === "documentos_fiscais") return { data: E.doc && !E.doc.anulado_em ? E.doc : null, error: null };
    if (tabela === "chamados") return { data: filtros.numero_publico || filtros.id ? { id: CHAMADO, numero_publico: "CH-2026-000777", contexto_tipo: E.contexto.tipo, contexto_id: E.contexto.id } : null, error: null };
    if (tabela === "chamado_mensagens") {
      // Os filtros da leitura valem como no banco: autor e interno.
      const notas = [...(E.notaDoChamado ? [{ corpo: E.notaDoChamado, autor: E.notaAutor, interno: E.notaInterna }] : []), ...E.notasExtra];
      const vistas = notas.filter((n) => (filtros.autor === undefined || n.autor === filtros.autor) && (filtros.interno === undefined || n.interno === filtros.interno));
      return { data: limite === null ? vistas : vistas.slice(0, limite), error: null };
    }
    return { data: null, error: null };
  };
  const escrever = () => {
    E.updates.push({ tabela, valores: valores!, filtros: { ...filtros } });
    if (tabela === "pagamentos_bloco") {
      // A guarda da corrida: só muda o que ainda não está anulado (e, pelo dono, o não confirmado).
      const passa = !E.pg.anulado_em && (filtros["confirmado_pelo_inquilino"] === undefined || filtros["confirmado_pelo_inquilino"] === E.pg.confirmado_pelo_inquilino);
      if (!passa) return { data: [], error: null };
      E.pg = { ...E.pg, anulado_em: String(valores!.anulado_em) };
      return { data: [{ id: E.pg.id }], error: null };
    }
    if (tabela === "documentos_fiscais" && E.doc) E.doc = { ...E.doc, anulado_em: String(valores!.anulado_em) };
    return { data: [{ id: "x" }], error: null };
  };
  b.update = (v: Record<string, unknown>) => ((valores = v), b);
  b.insert = (linha: Record<string, unknown>) => (E.inserts.push({ tabela, linha }), Object.assign(b, { _ins: true }));
  b.maybeSingle = async () => (valores ? escrever() : ler());
  b.single = async () => ({ data: { id: "novo" }, error: null });
  b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
    Promise.resolve((b as { _ins?: boolean })._ins ? { data: null, error: null } : valores ? escrever() : ler()).then(ok, ko);
  void comoSessao;
  return b;
}
/** A função do banco (0368): as guardas e as três escritas juntas, como a função faz numa transação só. */
async function rpc(nome: string, args: Record<string, unknown>) {
  E.rpcs.push({ nome, args });
  if (nome !== "anular_pagamento") return { data: null, error: { message: nome } };
  if (E.rpcFalha) return { data: null, error: { message: "falha simulada" } };
  if (E.rpcVazio) return { data: null, error: null };
  const passa = !E.pg.anulado_em && (args.p_caminho === "central" || !E.pg.confirmado_pelo_inquilino);
  if (!passa) return { data: { ok: false }, error: null };
  const agora = new Date().toISOString();
  E.pg = { ...E.pg, anulado_em: agora };
  const documento = E.doc && !E.doc.anulado_em ? E.doc.numero : null;
  if (E.doc && !E.doc.anulado_em) E.doc = { ...E.doc, anulado_em: agora };
  return { data: { ok: true, documento }, error: null };
}
const cliente = (uid: string, sessao: boolean) => ({
  auth: { getUser: async () => ({ data: { user: { id: uid } } }), admin: { getUserById: async () => ({ data: { user: { email: "morador@lab.test" } } }) } },
  from: (t: string) => consulta(t, sessao),
  rpc,
});

function cenario(o: { tipo?: "aluguel" | "caucao"; confirmado?: boolean; anulado?: boolean; quem?: string; equipe?: boolean; nota?: string | null; notaAutor?: string; notaInterna?: boolean; contratoDoPg?: string; contexto?: { tipo: string | null; id: string | null } } = {}) {
  E = {
    pg: { id: PG, contrato_id: o.contratoDoPg ?? CONTRATO, bloco_id: "b1", tipo: o.tipo ?? "aluguel", parte: 2, valor: 500, confirmado_pelo_inquilino: !!o.confirmado, anulado_em: o.anulado ? "2026-11-26T10:00:00Z" : null },
    doc: { id: "doc-1", numero: o.tipo === "caucao" ? "CAU-2026-000010" : "REC-2026-000123", anulado_em: null },
    notaDoChamado: o.nota === undefined ? `[anulacao] pagamento=${PG}` : o.nota,
    notaAutor: o.notaAutor ?? "sistema",
    notaInterna: o.notaInterna ?? true,
    notasExtra: [],
    contexto: o.contexto ?? { tipo: "contrato", id: CONTRATO },
    updates: [],
    inserts: [],
    rpcs: [],
    rpcFalha: false,
    rpcVazio: false,
  };
  g.__e1229Sessao = cliente(o.quem ?? DONO, true);
  g.__e1229Admin = cliente(o.quem ?? DONO, false);
  g.__e1229EhEquipe = !!o.equipe;
  g.__e1229Chamados = [];
  g.__e1229Avisos = [];
  g.__e1229Respostas = [];
}
const anulou = () => !!E.pg.anulado_em;
const chamadaDaFuncao = () => E.rpcs.find((r) => r.nome === "anular_pagamento")?.args;
const erro = (r: unknown) => (r as { error?: string }).error;

beforeEach(() => cenario());

test("1. o dono anula ANTES da confirmação: UMA chamada à função do banco, com o caminho do dono — o registro e o documento anulados juntos", async () => {
  const r = await anularRegistro({ pagamentoId: PG, motivo: MOTIVO });
  assert.equal(r.ok, true);
  assert.equal(E.rpcs.length, 1, "uma operação só");
  assert.deepEqual(chamadaDaFuncao(), { p_pagamento: PG, p_motivo: MOTIVO, p_autor: DONO, p_caminho: "dono", p_chamado: null });
  assert.ok(E.pg.anulado_em);
  assert.ok(E.doc?.anulado_em, "o documento ligado é anulado junto");
  assert.equal(E.updates.length, 0, "nenhuma escrita solta fora da função");
  assert.equal(E.inserts.filter((i) => i.tabela === "contrato_eventos").length, 0, "o evento é gravado pela função, não à parte");
});

test("2. (1169) a função falha: nada se anuncia — a ação recusa e o morador não é avisado", async () => {
  E.rpcFalha = true;
  const r = await anularRegistro({ pagamentoId: PG, motivo: MOTIVO });
  assert.equal(r.ok, false);
  assert.equal(E.pg.anulado_em, null);
  assert.equal(g.__e1229Avisos.length, 0, "o aviso só vem depois de a função dar certo");
});

test("3. o aviso ao morador (caminho do dono): 'O proprietário anulou o registro {REC} de {R$}: {motivo}'", async () => {
  await anularRegistro({ pagamentoId: PG, motivo: MOTIVO });
  assert.equal(g.__e1229Avisos.length, 1);
  assert.equal(g.__e1229Avisos[0].userId, MORADOR);
  // O R$ sai do formatBRLExato da casa (o espaço dele é o não separável do Intl).
  assert.equal(String(g.__e1229Avisos[0].tituloAviso).replace(/\u00a0/g, " "), `O proprietário anulou o registro REC-2026-000123 de R$ 500: ${MOTIVO}`);
});

test("4. o motivo é obrigatório (5 letras ou mais): sem ele, nada muda", async () => {
  const r = await anularRegistro({ pagamentoId: PG, motivo: " abc " });
  assert.equal(r.ok, false);
  assert.match(erro(r) ?? "", /motivo/i);
  assert.equal(E.updates.length, 0);
  assert.equal(E.inserts.length, 0);
});

test("5. quem não é o dono não anula", async () => {
  cenario({ quem: OUTRO });
  const r = await anularRegistro({ pagamentoId: PG, motivo: MOTIVO });
  assert.equal(r.ok, false);
  assert.equal(E.updates.length, 0);
});

test("6. já anulado: recusa, nada muda", async () => {
  cenario({ anulado: true });
  const r = await anularRegistro({ pagamentoId: PG, motivo: MOTIVO });
  assert.equal(r.ok, false);
  assert.match(erro(r) ?? "", /já foi anulado/);
  assert.equal(E.updates.length, 0);
});

test("7. DEPOIS da confirmação: a ação do dono é recusada e vira pedido à Central (chamado do registro, fila Financeiro)", async () => {
  cenario({ confirmado: true });
  const r = await anularRegistro({ pagamentoId: PG, motivo: MOTIVO });
  assert.equal(r.ok, true);
  assert.equal((r as { pedido?: string }).pedido, "CH-2026-000777");
  assert.equal(anulou(), false, "o dono não anula sozinho um registro confirmado");
  assert.equal(E.updates.filter((u) => u.tabela === "pagamentos_bloco").length, 0);
  const ch = g.__e1229Chamados[0] as { categoria: string; mensagem: string; contextoTipo: string; contextoId: string };
  assert.equal(ch.categoria, "cobranca");
  assert.equal(ch.contextoTipo, "contrato");
  assert.equal(ch.contextoId, CONTRATO);
  assert.match(ch.mensagem, /REC-2026-000123/);
  assert.match(ch.mensagem, /R\$\s500/);
  assert.match(ch.mensagem, new RegExp(MOTIVO));
  const nota = E.inserts.find((i) => i.tabela === "chamado_mensagens")!.linha;
  assert.equal(nota.corpo, `[anulacao] pagamento=${PG}`, "o chamado guarda, numa nota do sistema, qual registro é");
  assert.equal(nota.interno, true);
});

test("8. o pedido de anulação de CAUÇÃO cai na fila da caução", async () => {
  cenario({ confirmado: true, tipo: "caucao" });
  await anularRegistro({ pagamentoId: PG, motivo: MOTIVO });
  assert.equal((g.__e1229Chamados[0] as { categoria: string }).categoria, "caucao");
});

test("9. a Central (equipe) anula o confirmado: a função com o caminho 'central', o autor e o chamado; o aviso diz que foi a equipe; o dono recebe a decisão no chamado", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true });
  const r = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r.ok, true);
  assert.ok(E.pg.anulado_em);
  assert.deepEqual(chamadaDaFuncao(), { p_pagamento: PG, p_motivo: MOTIVO, p_autor: EQUIPE, p_caminho: "central", p_chamado: "CH-2026-000777" });
  // O aviso ao morador: a equipe, a pedido do proprietário (não "o proprietário anulou").
  assert.equal(g.__e1229Avisos.length, 1);
  assert.equal(String(g.__e1229Avisos[0].tituloAviso).replace(/\u00a0/g, " "), `A equipe da Viva anulou, a pedido do proprietário, o registro REC-2026-000123 de R$ 500: ${MOTIVO}.`);
  // A decisão ao dono: uma resposta VISÍVEL no chamado dele.
  assert.deepEqual(g.__e1229Respostas, [{ id: CHAMADO, texto: `A equipe anulou o registro REC-2026-000123. Motivo: ${MOTIVO}.`, interno: false }]);
  // A nota interna (quem decidiu e quando) fica para a equipe.
  const nota = E.inserts.find((i) => i.tabela === "chamado_mensagens")!.linha;
  assert.equal(nota.interno, true);
  assert.equal(nota.autor_id, EQUIPE);
});

test("10. o botão da Central é só da equipe", async () => {
  cenario({ confirmado: true, quem: DONO, equipe: false });
  const r = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r.ok, false);
  assert.equal(E.updates.length, 0);
});

test("11. a Central recusa o que já está anulado: dois cliques, uma anulação", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true });
  assert.equal((await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO })).ok, true);
  const r2 = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r2.ok, false);
  assert.match(erro(r2) ?? "", /já foi anulado/);
  assert.equal(E.rpcs.filter((x) => x.nome === "anular_pagamento").length, 1, "a função não volta a ser chamada para o já anulado");
});

test("12. um chamado que não nasceu de um registro não tem o que anular", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true, nota: null });
  const r = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r.ok, false);
  assert.equal(E.updates.length, 0);
});

// ── ORDEM-DUET-1170: as fugas da mordida (N6 e N7) ──────────────────────────────────────────────────────────────────
const OUTRO_CONTRATO = "99999999-8888-4777-8666-555555555555";
const naoAnulou = () => {
  assert.equal(E.rpcs.filter((x) => x.nome === "anular_pagamento").length, 0, "a função do banco não é chamada");
  assert.equal(E.pg.anulado_em, null);
  assert.equal(g.__e1229Avisos.length, 0);
  assert.equal(g.__e1229Respostas.length, 0);
};

test("13. (N6) a nota [anulacao] escrita por uma PESSOA (não do sistema) é recusada", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true, notaAutor: "usuario", notaInterna: false });
  const r = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r.ok, false);
  naoAnulou();
});

test("14. (N6) a nota [anulacao] do sistema mas NÃO interna (visível) é recusada", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true, notaAutor: "sistema", notaInterna: false });
  assert.equal((await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO })).ok, false);
  naoAnulou();
});

test("15. (N6) a nota [anulacao] interna escrita pela equipe (não pelo sistema) é recusada", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true, notaAutor: "admin", notaInterna: true });
  assert.equal((await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO })).ok, false);
  naoAnulou();
});

test("16. (N7) a nota a apontar para um pagamento de OUTRO contrato que não o do chamado é recusada", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true, contratoDoPg: OUTRO_CONTRATO });
  assert.equal((await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO })).ok, false);
  naoAnulou();
});

test("17. (N7) um chamado sem o contrato no contexto não anula registro nenhum (o pedido nasce sempre com o contrato)", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true, contexto: { tipo: null, id: null } });
  assert.equal((await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO })).ok, false);
  naoAnulou();
  cenario({ confirmado: true, quem: EQUIPE, equipe: true, contexto: { tipo: "anuncio", id: CONTRATO } });
  assert.equal((await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO })).ok, false);
  naoAnulou();
});

test("18. (N6, ORDEM-DUET-1174) a nota [anulacao] CERTA (do sistema, interna) num chamado cuja origem gravada aponta OUTRO contrato é recusada — a trava é a origem, não a nota", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true, notaAutor: "sistema", notaInterna: true, contexto: { tipo: "contrato", id: OUTRO_CONTRATO } });
  const r = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r.ok, false);
  naoAnulou();
});

// ── ORDEM-DUET-1177: o chamado com mais de um registro ─────────────────────────────────────────────────────────────
const PG_B = "44444444-5555-4666-8777-888888888888";

test("19. (1177) a nota do sistema para A e uma nota [anulacao] para B escrita como admin: anula só A", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true });
  E.notasExtra = [{ corpo: `[anulacao] pagamento=${PG_B}`, autor: "admin", interno: true }];
  const r = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r.ok, true);
  const chamadas = E.rpcs.filter((x) => x.nome === "anular_pagamento");
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].args.p_pagamento, PG, "só A");
});

test("20. (1177) duas notas do sistema (A e B): recusa — 'Este chamado tem mais de um registro; abra um pedido por registro.' — e nada é anulado", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true });
  E.notasExtra = [{ corpo: `[anulacao] pagamento=${PG_B}`, autor: "sistema", interno: true }];
  const r = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r.ok, false);
  assert.equal(erro(r), "Este chamado tem mais de um registro; abra um pedido por registro.");
  naoAnulou();
});

test("21. (1177) a mesma nota do sistema repetida (um só registro): segue como está", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true });
  E.notasExtra = [{ corpo: `[anulacao] pagamento=${PG}`, autor: "sistema", interno: true }];
  assert.equal((await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO })).ok, true);
  assert.equal(E.rpcs.filter((x) => x.nome === "anular_pagamento").length, 1);
});

// ── ORDEM-DUET-1181: as fugas da re-mordida (H4, R1, R2) ───────────────────────────────────────────────────────────

test("22. (H4) as notas do sistema lêem-se TODAS: a 2.ª nota do sistema (B) depois de 20 notas do sistema de A repetidas ainda recusa", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true });
  E.notasExtra = [...Array.from({ length: 20 }, () => ({ corpo: `[anulacao] pagamento=${PG}`, autor: "sistema", interno: true })), { corpo: `[anulacao] pagamento=${PG_B}`, autor: "sistema", interno: true }];
  const r = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r.ok, false);
  assert.equal(erro(r), "Este chamado tem mais de um registro; abra um pedido por registro.");
  naoAnulou();
});

test("23. (R1) a função devolve vazio (sem erro e sem resposta): a ação recusa, não segue — nada se anuncia", async () => {
  E.rpcVazio = true;
  const r = await anularRegistro({ pagamentoId: PG, motivo: MOTIVO });
  assert.equal(r.ok, false);
  assert.equal(g.__e1229Avisos.length, 0);
  cenario({ confirmado: true, quem: EQUIPE, equipe: true });
  E.rpcVazio = true;
  const r2 = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(r2.ok, false);
  assert.equal(g.__e1229Avisos.length, 0);
  assert.equal(g.__e1229Respostas.length, 0, "nenhuma resposta ao dono");
});

test("24. (R2) a chamada da função dá erro: a ação recusa com a mensagem de leitura — nunca 'já foi anulado'", async () => {
  E.rpcFalha = true;
  const r = await anularRegistro({ pagamentoId: PG, motivo: MOTIVO });
  assert.equal(r.ok, false);
  assert.equal(erro(r), "Não foi possível ler o registro. Tente de novo em instantes.");
  cenario({ confirmado: true, quem: EQUIPE, equipe: true });
  E.rpcFalha = true;
  const r2 = await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO });
  assert.equal(erro(r2), "Não foi possível ler o registro. Tente de novo em instantes.");
  assert.equal(g.__e1229Respostas.length, 0);
});

// ── E1241 (ORDENS-DUET 1213 e 1227; MAPA-E1241): a anulação lê o TOTAL do registro, não a coluna valor ───────────────
// O registro complementar da prova (27/11): o valor do bloco é zero, os R$ 800 estão todos nos encargos.
const COMPLEMENTAR = [{ rotulo: "Contas do período", valor: 550 }, { rotulo: "Limpeza de preparação", valor: 250 }];
const R800 = /R\$\s800(,00)?\b/;

test("32. (E1241) o dono anula um registro complementar (valor 0, R$ 800 em encargos): o aviso diz R$ 800, nunca R$ 0", async () => {
  cenario();
  E.pg = { ...E.pg, valor: 0, encargos: COMPLEMENTAR };
  assert.equal((await anularRegistro({ pagamentoId: PG, motivo: MOTIVO })).ok, true);
  const aviso = String(g.__e1229Avisos[0].tituloAviso).replace(/\u00a0/g, " ");
  assert.match(aviso, R800);
  assert.doesNotMatch(aviso, /R\$\s0\b/);
  const corpo = String((g.__e1229Avisos[0].body as (n?: string) => string)("Ana")).replace(/\u00a0/g, " ");
  assert.match(corpo, R800, "o e-mail também");
});

test("33. (E1241) o mesmo, já confirmado: o texto do pedido à Central diz R$ 800", async () => {
  cenario({ confirmado: true });
  E.pg = { ...E.pg, valor: 0, encargos: COMPLEMENTAR };
  assert.equal((await anularRegistro({ pagamentoId: PG, motivo: MOTIVO })).ok, true);
  const pedido = g.__e1229Chamados[0] as { mensagem: string };
  assert.match(pedido.mensagem.replace(/\u00a0/g, " "), R800);
});

test("34. (E1241) a Central decide: o aviso ao morador e a nota interna dizem R$ 800", async () => {
  cenario({ confirmado: true, quem: EQUIPE, equipe: true });
  E.pg = { ...E.pg, valor: 0, encargos: COMPLEMENTAR };
  assert.equal((await anularRegistroPelaCentral({ chamadoId: CHAMADO, motivo: MOTIVO })).ok, true);
  assert.match(String(g.__e1229Avisos[0].tituloAviso).replace(/\u00a0/g, " "), R800);
  const nota = E.inserts.find((i) => i.tabela === "chamado_mensagens")!.linha;
  assert.match(String(nota.corpo).replace(/\u00a0/g, " "), R800);
});

test("35. (E1241) guarda: o aluguel simples e a caução mostram o valor de hoje (na caução os encargos não contam)", async () => {
  cenario();
  assert.equal((await anularRegistro({ pagamentoId: PG, motivo: MOTIVO })).ok, true);
  assert.match(String(g.__e1229Avisos[0].tituloAviso).replace(/\u00a0/g, " "), /R\$\s500\b/);
  cenario({ tipo: "caucao" });
  E.pg = { ...E.pg, encargos: [{ rotulo: "Contas do período", valor: 99 }] };
  assert.equal((await anularRegistro({ pagamentoId: PG, motivo: MOTIVO })).ok, true);
  assert.match(String(g.__e1229Avisos[0].tituloAviso).replace(/\u00a0/g, " "), /R\$\s500\b/);
});
