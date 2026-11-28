/*
  E1248 PR 1 — a máquina da devolução da caução, nas AÇÕES e na ROTINA REAIS (ESPEC-E1248 v11, secções 2, 5.2, 8.2 e
  9-A; ORDENS-DUET 1355 e 1357). Corre no harness e1248-harness: as ações do registro, da resposta, do anexo e da decisão
  da Central e a rotina de hora a hora são as de produção; só as bordas são dublês (sessão, equipe, chamado, termo, envio).
  O aviso grava-se pela gravarAviso real num banco falso fiel (src/lib/testes/banco-falso.ts).
  Casos: T1, a metade do acerto de T2, T3 e T4 (o corte da ORDEM-1352), M1 a M12, M14 a M23, M26, M27, M29, M30 e M32 a
  M35, mais a metade do acerto de M36 e M37. O M13 está na trava pura (e1248-relogio.test.ts) e aqui na rotina; M24, M25,
  M28 e M31 estão nas travas da tela e da leitura do comprovante.
  Roda: node --test src/lib/data/e1248-devolucao-maquina.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

register("./e1248-harness/loader.mjs", import.meta.url);
const { criarBanco } = await import("../testes/banco-falso.ts");
const docs = (await import("./documentos-actions.ts")) as unknown as {
  registrarDevolucaoCaucao: (i: { contratoId: string; valorDevolvido: number; dataDevolucao: string; meio: string }) => Promise<{ ok: boolean; error?: string; id?: string }>;
  responderDevolucaoCaucao: (id: string, r: "confirmar" | "contestar", motivo?: string) => Promise<{ ok: boolean; error?: string }>;
};
const acoes = (await import("./devolucao-caucao-actions.ts").catch(() => ({}))) as {
  anexarComprovanteDaDevolucao?: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
  decidirDevolucaoPelaCentral?: (i: { chamadoId: string; decisao: "confirmada" | "nao_confirmada"; motivo?: string }) => Promise<{ ok: boolean; error?: string }>;
};
const servidor = (await import("../caucao/devolucao-servidor.ts").catch(() => ({}))) as {
  rodarDevolucaoCaucao?: (admin: unknown, agora: Date) => Promise<unknown>;
};
const m = await import("../caucao/devolucao-maquina.ts");
const { calcularPrazos } = await import("../../config/atendimento.ts");
const { TEMPLATES } = await import("../notifications/eventos-email.ts");
const { MATRIZ_NOTIFICACOES } = await import("../../config/matriz-notificacoes.ts");
const { TEMA_POR_EVENTO } = await import("../notifications/imagens-email.ts");
const { prioridadeDoAviso } = await import("../notifications/avisos.ts");
const { acaoDaFaixa } = await import("../notifications/sino.ts");

const anexar = (fd: FormData) => {
  assert.equal(typeof acoes.anexarComprovanteDaDevolucao, "function", "anexarComprovanteDaDevolucao existe");
  return acoes.anexarComprovanteDaDevolucao!(fd);
};
const decidir = (i: { chamadoId: string; decisao: "confirmada" | "nao_confirmada"; motivo?: string }) => {
  assert.equal(typeof acoes.decidirDevolucaoPelaCentral, "function", "decidirDevolucaoPelaCentral existe");
  return acoes.decidirDevolucaoPelaCentral!(i);
};
const rodar = (agora: Date) => {
  assert.equal(typeof servidor.rodarDevolucaoCaucao, "function", "rodarDevolucaoCaucao existe");
  return servidor.rodarDevolucaoCaucao!(db.admin, agora);
};

type Linha = Record<string, unknown>;
type Envio = { event: string; userId?: string; refId?: string | null; pushUrl?: string; textoAviso?: string | null; prioridadeAviso?: string | null; ctaLabel?: string; papelAviso?: string | null };
const g = globalThis as unknown as {
  __e1248Sessao: unknown;
  __e1248Admin: unknown;
  __e1248EhEquipe: boolean;
  __e1248Observador: string | null;
  __e1248Envios: Envio[];
  __e1248FalhaNotify: boolean;
  __e1248Chamados: Linha[];
  __e1248Respostas: { id: string; texto: string; interno: boolean }[];
  __e1248Termos: string[];
  __e1248Limpos: number[];
  __e1248FalhaChamado: boolean;
  __e1248SoSino: boolean;
  __e1248AvisosAtendimento: { quem: string; id: string }[];
};

const DONO = "d0d0d0d0-0000-4000-8000-000000000001";
const MORADOR = "a0a0a0a0-0000-4000-8000-000000000002";
const EQUIPE = "e0e0e0e0-0000-4000-8000-000000000003";
const OUTRO = "a0a0a0a0-0000-4000-8000-000000000004";
const C = "c0c0c0c0-0000-4000-8000-0000000000c1";
const C2 = "c0c0c0c0-0000-4000-8000-0000000000c2";
const H = 3_600_000;
const URL_MORADOR = "/dashboard/locacoes";
/** A tela onde o dono vê a devolução (a página de um contrato não a mostra). */
const URL_DONO = `/dashboard/contratos#contrato-${C}`;

let db: ReturnType<typeof criarBanco>;
const sessao = (uid: string | null) => ({ auth: { getUser: async () => ({ data: { user: uid ? { id: uid } : null } }) } });
const como = (uid: string | null) => {
  g.__e1248Sessao = sessao(uid);
  g.__e1248EhEquipe = uid === EQUIPE;
};

beforeEach(() => {
  db = criarBanco({
    contratos: [
      { id: C, status: "concluido", tenant_id: MORADOR, properties: { owner_id: DONO, title: "Apto Centro" } },
      { id: C2, status: "concluido", tenant_id: OUTRO, properties: { owner_id: DONO, title: "Casa Praia" } },
    ],
    pagamentos_bloco: [
      { contrato_id: C, tipo: "caucao", valor: 3200, confirmado_pelo_inquilino: true, anulado_em: null },
      { contrato_id: C2, tipo: "caucao", valor: 1000, confirmado_pelo_inquilino: true, anulado_em: null },
    ],
    caucao_acertos: [],
    chamados: [],
    chamado_mensagens: [],
    avisos: [],
    profiles: [
      { id: DONO, is_teste: false, full_name: "Dono" },
      { id: MORADOR, is_teste: false, full_name: "Morador" },
      { id: OUTRO, is_teste: false, full_name: "Outro" },
    ],
  });
  g.__e1248Admin = db.admin;
  g.__e1248Observador = null;
  g.__e1248Envios = [];
  g.__e1248FalhaNotify = false;
  g.__e1248Chamados = [];
  g.__e1248Respostas = [];
  g.__e1248Termos = [];
  g.__e1248Limpos = [];
  g.__e1248FalhaChamado = false;
  g.__e1248SoSino = false;
  g.__e1248AvisosAtendimento = [];
  como(null);
});

const acertos = () => db.banco.caucao_acertos;
const acerto = (id: string) => acertos().find((a) => a.id === id)!;
const envios = (ev: string, uid?: string) => g.__e1248Envios.filter((e) => e.event === ev && (uid ? e.userId === uid : true));
const avisos = (ev: string, uid: string) => db.banco.avisos.filter((a) => a.evento === ev && a.usuario_id === uid);
const aberto = (a: Linha | undefined) => !!a && (a.resolvido_em ?? null) === null;
/** Resolvido: o aviso EXISTE e tem resolvido_em (um aviso que não nasceu não conta). */
const resolvido = (a: Linha | undefined) => !!a && !!a.resolvido_em;

/** Um acerto já gravado, à espera, com o aviso de há `horas` horas (o modo de pôr o relógio sem esperar 5 dias). */
function semearAcerto(extra: Linha = {}): string {
  const id = globalThis.crypto.randomUUID();
  acertos().push({
    id,
    contrato_id: C,
    tipo: "devolucao_integral",
    caucao_total: 3200,
    valor_devolvido: 3200,
    data_devolucao: "2026-11-27",
    meio: "pix",
    status: "aguardando_confirmacao",
    registrado_por: DONO,
    confirmado_em: null,
    created_at: "2026-11-27T13:00:00.000Z",
    aviso_em: null,
    lembrete_em: null,
    confirmacao_via: null,
    contestacao_motivo: null,
    contestado_em: null,
    chamado_id: null,
    central_decisao: null,
    central_decidido_em: null,
    central_decidido_por: null,
    central_motivo: null,
    comprovante_path: null,
    comprovante_pedido_em: null,
    comprovante_anexado_em: null,
    comprovante_lembrete_em: null,
    ...extra,
  });
  return id;
}
const haHoras = (h: number, base = Date.now()) => new Date(base - h * H).toISOString();

async function registrar(valor = 3200, meio = "pix") {
  como(DONO);
  return docs.registrarDevolucaoCaucao({ contratoId: C, valorDevolvido: valor, dataDevolucao: "2026-11-27", meio });
}
async function contestar(id: string, motivo = "Não recebi o valor.") {
  como(MORADOR);
  return docs.responderDevolucaoCaucao(id, "contestar", motivo);
}
/** Um PDF de verdade (uma página), que a marca da leitura consegue abrir. */
const { PDFDocument } = await import("pdf-lib");
const PDF_REAL = await (async () => {
  const d = await PDFDocument.create();
  d.addPage([200, 200]);
  return d.save();
})();
const PDF = () => PDF_REAL.slice();
/** Só o cabeçalho "%PDF" e espaços: passa pelo tipo, mas nenhum leitor o abre. */
const PDF_QUE_NAO_ABRE = () => {
  const corpo = new Uint8Array(2048).fill(0x20);
  corpo.set([0x25, 0x50, 0x44, 0x46], 0);
  corpo.set(new TextEncoder().encode("%%EOF"), 2040);
  return corpo;
};
const JPG = () => {
  const b = new Uint8Array(4096);
  b.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return b;
};
const formulario = (acertoId: string, bytes: Uint8Array, nome = "comprovante.pdf") => {
  const fd = new FormData();
  fd.set("acertoId", acertoId);
  fd.set("arquivo", new File([bytes as BlobPart], nome));
  return fd;
};
const chamadoDo = (id: string) => db.banco.chamados.find((c) => c.id === acerto(id).chamado_id)!;

// ——————————————————————————————— o registro e o aviso ———————————————————————————————

test("T1. o registro dispara o aviso ao morador: o valor, a data e o prazo; o acerto guarda a hora do aviso", async () => {
  const antes = Date.now();
  const r = await registrar();
  assert.equal(r.ok, true, r.error);
  const a = acerto(r.id!);
  assert.ok(a.aviso_em, "a hora do aviso fica gravada");
  assert.ok(Date.parse(String(a.aviso_em)) >= antes, "a hora é a do envio");
  const [e] = envios("caucao_devolucao_registrada", MORADOR);
  assert.ok(e, "o morador é avisado, com o evento próprio");
  assert.equal(e.refId, C, "a referência é o contrato");
  assert.equal(e.pushUrl, URL_MORADOR, "o botão leva a Minhas locações");
  assert.equal(e.textoAviso, m.textoAvisoDoRegistro({ valor: 3200, dataDevolucao: "2026-11-27" }));
  const [av] = avisos("caucao_devolucao_registrada", MORADOR);
  assert.equal(av?.prioridade, "normal", "decisão 7: normal");
  assert.equal(av?.ref_id, C);
  assert.equal(envios("caucao_devolucao_registrada", DONO).length, 0, "o dono não recebe o próprio aviso");
});

test("M26. o registro sem comprovante é aceite: no registro ele é opcional", async () => {
  const r = await registrar();
  assert.equal(r.ok, true);
  assert.equal(acerto(r.id!).comprovante_path ?? null, null);
  assert.equal(acerto(r.id!).comprovante_pedido_em ?? null, null, "o pedido só nasce na disputa");
});

test("M4. o aviso que falhou não grava a hora; um acerto sem ela nunca confirma por falta de resposta", async () => {
  g.__e1248FalhaNotify = true;
  const r = await registrar();
  assert.equal(r.ok, true, "o registro vale; só o aviso falhou");
  assert.equal(acerto(r.id!).aviso_em ?? null, null);
  const antigo = semearAcerto({ contrato_id: C2, aviso_em: null, created_at: haHoras(24 * 30) });
  g.__e1248FalhaNotify = false;
  await rodar(new Date(Date.now() + 365 * 24 * H));
  assert.equal(acerto(r.id!).status, "aguardando_confirmacao");
  assert.equal(acerto(antigo).status, "aguardando_confirmacao", "o acerto anterior ao E1248");
  assert.equal(g.__e1248Termos.length, 0);
});

test("M15. com a disputa aberta, o dono não registra outra devolução", async () => {
  semearAcerto({ status: "desconto_contestado", contestado_em: haHoras(2), contestacao_motivo: "Não recebi o valor.", aviso_em: haHoras(30) });
  const r = await registrar(3000);
  assert.equal(r.ok, false);
  assert.match(String(r.error), /contesta|equipe|decis/i);
  assert.equal(acertos().length, 1, "nada é gravado");
  assert.equal(envios("caucao_devolucao_registrada").length, 0);
});

test("M15. um contestado anterior ao E1248 (sem a hora da contestação) não trava o registro, como hoje", async () => {
  semearAcerto({ status: "desconto_contestado", contestado_em: null });
  const r = await registrar(3000);
  assert.equal(r.ok, true, r.error);
});

test("M16. depois de um \"não vale\", o dono registra de novo: nasce um aviso novo, com 5 dias novos", async () => {
  const velho = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(200), contestado_em: haHoras(100), contestacao_motivo: "Não recebi.", central_decisao: "nao_confirmada", central_decidido_em: haHoras(1), central_motivo: "sem prova" });
  db.banco.avisos.push({ id: "av-velho", usuario_id: MORADOR, evento: "caucao_devolucao_registrada", ref_id: C, prioridade: "normal", titulo: "x", lido_em: null, resolvido_em: haHoras(100), criado_em: haHoras(200) });
  const r = await registrar(3200);
  assert.equal(r.ok, true, r.error);
  assert.notEqual(r.id, velho);
  const novo = acerto(r.id!);
  assert.ok(Date.parse(String(novo.aviso_em)) > Date.now() - 60_000, "a hora do aviso é a de agora: 5 dias novos");
  assert.equal(avisos("caucao_devolucao_registrada", MORADOR).filter(aberto).length, 1, "um aviso novo, aberto");
});

// ——————————————————————————————— a resposta do morador ———————————————————————————————

test("M1 e M18. o morador confirma no dia 2: confirmada pelo morador; os avisos dele saem; o termo sai", async () => {
  const r = await registrar();
  const id = r.id!;
  acerto(id).aviso_em = haHoras(30);
  db.banco.avisos.push({ id: "lem", usuario_id: MORADOR, evento: "caucao_devolucao_lembrete", ref_id: C, prioridade: "critico", titulo: "x", lido_em: null, resolvido_em: null, criado_em: haHoras(1) });
  como(MORADOR);
  const res = await docs.responderDevolucaoCaucao(id, "confirmar");
  assert.equal(res.ok, true, res.error);
  const a = acerto(id);
  assert.equal(a.status, "devolvida_integral");
  assert.equal(a.confirmacao_via, "morador");
  assert.ok(a.confirmado_em);
  assert.ok(resolvido(avisos("caucao_devolucao_registrada", MORADOR)[0]), "o aviso principal sai");
  assert.ok(resolvido(avisos("caucao_devolucao_lembrete", MORADOR)[0]), "o lembrete sai");
  assert.deepEqual(g.__e1248Termos, [id], "o termo sai, uma vez");
});

test("M14. a devolução parcial, confirmada pelo morador: igual à total", async () => {
  const r = await registrar(2000);
  como(MORADOR);
  assert.equal((await docs.responderDevolucaoCaucao(r.id!, "confirmar")).ok, true);
  assert.equal(acerto(r.id!).status, "desconto_confirmado");
  assert.equal(acerto(r.id!).confirmacao_via, "morador");
  assert.deepEqual(g.__e1248Termos, [r.id]);
});

test("só o morador responde: o dono e outra conta são recusados", async () => {
  const id = semearAcerto({ aviso_em: haHoras(2) });
  for (const uid of [DONO, OUTRO]) {
    como(uid);
    const res = await docs.responderDevolucaoCaucao(id, "confirmar");
    assert.equal(res.ok, false, uid);
  }
  assert.equal(acerto(id).status, "aguardando_confirmacao");
});

test("M6. contestar sem motivo, ou com menos de 5 letras: recusado, com a mensagem; nada muda", async () => {
  const id = semearAcerto({ aviso_em: haHoras(2) });
  for (const motivo of [undefined, "", "   ", "abcd", " ab  "]) {
    como(MORADOR);
    const res = await docs.responderDevolucaoCaucao(id, "contestar", motivo as string);
    assert.equal(res.ok, false, JSON.stringify(motivo));
    assert.match(String(res.error), /motivo/i);
  }
  assert.equal(acerto(id).status, "aguardando_confirmacao");
  assert.equal(acerto(id).contestado_em ?? null, null);
  assert.equal(g.__e1248Chamados.length, 0, "nenhum chamado");
});

test("M7 e T3 (a metade do acerto). o morador contesta com motivo: contestada; o chamado nasce no nome dele, com a nota do acerto", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30) });
  const res = await contestar(id, "  Não recebi o valor.  ");
  assert.equal(res.ok, true, res.error);
  const a = acerto(id);
  assert.equal(a.status, "desconto_contestado");
  assert.ok(a.contestado_em, "a hora da contestação: o início da disputa");
  assert.equal(a.contestacao_motivo, "Não recebi o valor.");
  assert.equal(g.__e1248Chamados.length, 1);
  const pedido = g.__e1248Chamados[0];
  assert.equal(pedido.categoria, "caucao", "a fila da caução");
  assert.equal(pedido.contextoTipo, "contrato");
  assert.equal(pedido.contextoId, C);
  assert.equal(pedido.pedePessoa, true);
  const msg = String(pedido.mensagem);
  assert.match(msg, /R\$ 3\.200,00/, "o valor");
  assert.match(msg, /Não recebi o valor\./, "o motivo");
  assert.match(msg, /27\/11\/2026/, "a data da devolução");
  assert.ok(msg.includes(m.NOTA_DA_FASE_PARA_A_EQUIPE), "o que a equipe decide nesta fase");
  const ch = chamadoDo(id);
  assert.equal(ch.usuario_id, MORADOR, "no nome do morador");
  const nota = db.banco.chamado_mensagens.find((n) => n.chamado_id === ch.id && n.autor === "sistema");
  assert.equal(nota?.corpo, `[devolucao] acerto=${id}`);
  assert.equal(nota?.interno, true);
});

test("texto 2. a contestação avisa o dono, com o motivo, pelo botão \"Ver a caução\"", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30) });
  db.banco.avisos.push({ id: "reg", usuario_id: MORADOR, evento: "caucao_devolucao_registrada", ref_id: C, prioridade: "normal", titulo: "x", lido_em: null, resolvido_em: null, criado_em: haHoras(30) });
  await contestar(id, "Não recebi o valor.");
  assert.ok(resolvido(avisos("caucao_devolucao_registrada", MORADOR)[0]), "a contestação é uma resposta: o aviso do morador sai");
  const [e] = envios("caucao_devolucao_contestada", DONO);
  assert.ok(e);
  assert.equal(e.textoAviso, m.textoContestacaoAoDono({ valor: 3200, motivo: "Não recebi o valor." }));
  assert.equal(e.pushUrl, URL_DONO);
  assert.equal(e.ctaLabel, "Ver a caução");
  assert.equal(e.refId, C);
});

test("M29 e M32. contesta sem comprovante: o dono recebe o pedido, com a hora do fim do prazo; o prazo da decisão não conta até ao anexo", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30) });
  const antes = Date.now();
  await contestar(id);
  const a = acerto(id);
  assert.ok(a.comprovante_pedido_em, "o pedido fica gravado");
  assert.ok(Date.parse(String(a.comprovante_pedido_em)) >= antes);
  const [e] = envios("caucao_comprovante_pedido", DONO);
  assert.ok(e, "o aviso do pedido");
  assert.equal(e.textoAviso, m.textoPedidoDoComprovante({ meio: "pix", valor: 3200, pedidoEm: String(a.comprovante_pedido_em) }));
  assert.equal(e.ctaLabel, "Anexar o comprovante");
  assert.equal(e.pushUrl, URL_DONO);
  assert.equal(avisos("caucao_comprovante_pedido", DONO)[0]?.prioridade, "normal", "o pedido é normal; só o lembrete é crítico");
  const fimDoAnexo = m.fimDoPrazoDoAnexo(String(a.comprovante_pedido_em));
  assert.equal(chamadoDo(id).prazo_resolucao, calcularPrazos("p2", fimDoAnexo).resolucao.toISOString(), "o prazo da decisão começa no fim do prazo do anexo");
});

test("M29. contesta com o comprovante já anexado: nenhum pedido", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30), comprovante_path: `${DONO}/x.pdf`, comprovante_anexado_em: haHoras(20) });
  await contestar(id);
  assert.equal(acerto(id).comprovante_pedido_em ?? null, null);
  assert.equal(envios("caucao_comprovante_pedido").length, 0);
});

test("M22 e M23. a resposta tardia é recusada, com a mensagem; a ação grava a confirmação por falta de resposta, com a hora do fim do prazo", async () => {
  const aviso = haHoras(120, Date.now() - 1000); // o prazo terminou há um segundo
  const id = semearAcerto({ aviso_em: aviso });
  como(MORADOR);
  const res = await docs.responderDevolucaoCaucao(id, "contestar", "Não recebi o valor.");
  assert.equal(res.ok, false);
  assert.equal(res.error, m.textoRespostaTardia({ avisoEm: aviso }));
  const fim = m.fimDoPrazoDeResposta(aviso).toISOString();
  assert.equal(acerto(id).status, "devolvida_integral");
  assert.equal(acerto(id).confirmacao_via, "falta_de_resposta");
  assert.equal(acerto(id).confirmado_em, fim, "a hora do fim do prazo, nunca a da resposta");
  assert.equal(g.__e1248Chamados.length, 0, "a contestação tardia não abre chamado");
  await rodar(new Date(Date.parse(fim) + H));
  assert.equal(acerto(id).confirmado_em, fim, "depois de a rotina correr, a mesma hora");
  assert.deepEqual(g.__e1248Termos, [id], "um termo só");
});

test("M22. a trava do coordenador: o prazo termina às 10:00; a resposta às 10:00:01 é recusada; a rotina das 11:00 não muda a hora", async () => {
  const aviso = "2026-11-20T13:00:00.000Z"; // 20/11 10:00 em Brasília; o prazo termina a 25/11 10:00
  const id = semearAcerto({ aviso_em: aviso });
  const fim = "2026-11-25T13:00:00.000Z";
  como(MORADOR);
  const res = await docs.responderDevolucaoCaucao(id, "confirmar");
  assert.equal(res.ok, false);
  assert.equal(res.error, "O prazo para responder terminou em 25/11 10:00; a devolução valeu como confirmada.");
  assert.equal(acerto(id).confirmado_em, fim);
  await rodar(new Date("2026-11-25T14:00:00.000Z"));
  assert.equal(acerto(id).confirmado_em, fim);
  assert.equal(acerto(id).confirmacao_via, "falta_de_resposta");
});

// ——————————————————————————————— o comprovante ———————————————————————————————

test("M27. o dono anexa um PDF: guardado no bucket da conferência, na pasta dele; o caminho cabe na regra da 0371", async () => {
  const id = semearAcerto({ aviso_em: haHoras(2) });
  como(DONO);
  const r = await anexar(formulario(id, PDF()));
  assert.equal(r.ok, true, r.error);
  const a = acerto(id);
  assert.match(String(a.comprovante_path), /^[0-9a-zA-Z-]+\/[0-9a-zA-Z_-]+\.(pdf|jpg|png|webp)$/);
  assert.ok(String(a.comprovante_path).startsWith(`${DONO}/`));
  assert.ok(db.arquivos.has(`conferencia/${a.comprovante_path}`), "no bucket privado da conferência");
  assert.ok(a.comprovante_anexado_em);
});

test("M27. a imagem entra sem metadados", async () => {
  const id = semearAcerto({ aviso_em: haHoras(2) });
  como(DONO);
  const r = await anexar(formulario(id, JPG(), "foto.jpg"));
  assert.equal(r.ok, true, r.error);
  assert.equal(g.__e1248Limpos.length, 1, "a imagem passou pela remoção dos metadados");
  assert.match(String(acerto(id).comprovante_path), /\.jpg$/);
});

test("o anexo: só o dono do contrato; um arquivo que não é PDF nem imagem é recusado", async () => {
  const id = semearAcerto({ aviso_em: haHoras(2) });
  for (const uid of [MORADOR, OUTRO]) {
    como(uid);
    assert.equal((await anexar(formulario(id, PDF()))).ok, false, uid);
  }
  como(DONO);
  assert.equal((await anexar(formulario(id, new TextEncoder().encode("texto qualquer, não é um arquivo válido"), "a.txt"))).ok, false);
  assert.equal(acerto(id).comprovante_path ?? null, null);
  assert.equal(db.arquivos.size, 0);
});

test("M27. um PDF que nenhum leitor abre é recusado: a prova guardada tem de se poder ler", async () => {
  const id = semearAcerto({ aviso_em: haHoras(2) });
  como(DONO);
  const r = await anexar(formulario(id, PDF_QUE_NAO_ABRE()));
  assert.equal(r.ok, false);
  assert.match(String(r.error), /PDF/);
  assert.equal(acerto(id).comprovante_path ?? null, null);
  assert.equal(db.arquivos.size, 0, "nada vai ao bucket");
});

test("M30. o dono anexa depois do pedido: o prazo da decisão conta da hora do anexo; o pedido e o lembrete dele saem", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30) });
  await contestar(id);
  db.banco.avisos.push({ id: "lem-anexo", usuario_id: DONO, evento: "caucao_comprovante_lembrete", ref_id: C, prioridade: "critico", titulo: "x", lido_em: null, resolvido_em: null, criado_em: haHoras(1) });
  como(DONO);
  const r = await anexar(formulario(id, PDF()));
  assert.equal(r.ok, true, r.error);
  const anexadoEm = String(acerto(id).comprovante_anexado_em);
  assert.equal(chamadoDo(id).prazo_resolucao, calcularPrazos("p2", new Date(anexadoEm)).resolucao.toISOString());
  assert.ok(resolvido(avisos("caucao_comprovante_pedido", DONO)[0]), "o pedido sai");
  assert.ok(resolvido(avisos("caucao_comprovante_lembrete", DONO)[0]), "o lembrete do anexo sai");
});

test("M35. o dono anexa depois do prazo do anexo, antes da decisão: aceite", async () => {
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(300), contestado_em: haHoras(150), contestacao_motivo: "Não recebi.", comprovante_pedido_em: haHoras(150) });
  como(DONO);
  assert.equal((await anexar(formulario(id, PDF()))).ok, true);
  assert.ok(acerto(id).comprovante_path);
});

test("depois da decisão da Central, o anexo é recusado", async () => {
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(300), contestado_em: haHoras(150), contestacao_motivo: "Não recebi.", central_decisao: "nao_confirmada", central_decidido_em: haHoras(1), central_motivo: "sem prova" });
  como(DONO);
  assert.equal((await anexar(formulario(id, PDF()))).ok, false);
});

// ——————————————————————————————— a decisão da Central ———————————————————————————————

async function disputa(opc: { valor?: number; comAnexo?: boolean; meio?: string } = {}) {
  const valor = opc.valor ?? 3200;
  const id = semearAcerto({ aviso_em: haHoras(30), valor_devolvido: valor, tipo: valor === 3200 ? "devolucao_integral" : "desconto", meio: opc.meio ?? "pix" });
  await contestar(id);
  if (opc.comAnexo !== false) {
    como(DONO);
    assert.equal((await anexar(formulario(id, PDF()))).ok, true);
  }
  g.__e1248Envios = [];
  como(EQUIPE);
  return { id, chamadoId: String(acerto(id).chamado_id) };
}

test("M12. quem não é da equipe não decide", async () => {
  const { id, chamadoId } = await disputa();
  for (const uid of [MORADOR, DONO, OUTRO]) {
    como(uid);
    const r = await decidir({ chamadoId, decisao: "confirmada" });
    assert.equal(r.ok, false, uid);
  }
  assert.equal(acerto(id).central_decisao ?? null, null);
});

test("M11. um chamado de outro contrato, ou sem contrato, não decide", async () => {
  const { id, chamadoId } = await disputa();
  const ch = db.banco.chamados.find((c) => c.id === chamadoId)!;
  ch.contexto_id = C2;
  assert.equal((await decidir({ chamadoId, decisao: "confirmada" })).ok, false, "outro contrato");
  ch.contexto_id = null;
  ch.contexto_tipo = null;
  assert.equal((await decidir({ chamadoId, decisao: "confirmada" })).ok, false, "sem contrato");
  const semNota = globalThis.crypto.randomUUID();
  db.banco.chamados.push({ id: semNota, numero_publico: "CH-2026-000999", contexto_tipo: "contrato", contexto_id: C, simulacao: false });
  assert.equal((await decidir({ chamadoId: semNota, decisao: "confirmada" })).ok, false, "um chamado sem a nota do acerto");
  assert.equal(acerto(id).central_decisao ?? null, null);
});

test("a conta observadora e o chamado de simulação seguem as guardas do E1229", async () => {
  const { id, chamadoId } = await disputa();
  g.__e1248Observador = "A conta observadora só decide com as duas partes de teste.";
  const r1 = await decidir({ chamadoId, decisao: "confirmada" });
  assert.equal(r1.ok, false);
  assert.equal(r1.error, "A conta observadora só decide com as duas partes de teste.");
  g.__e1248Observador = null;
  db.banco.chamados.find((c) => c.id === chamadoId)!.simulacao = true;
  assert.equal((await decidir({ chamadoId, decisao: "confirmada" })).ok, false, "simulação com contas reais");
  assert.equal(acerto(id).central_decisao ?? null, null);
});

test("com o prazo do anexo a correr e sem comprovante, a equipe ainda não decide", async () => {
  const { id, chamadoId } = await disputa({ comAnexo: false });
  const r = await decidir({ chamadoId, decisao: "nao_confirmada", motivo: "Sem prova." });
  assert.equal(r.ok, false);
  assert.match(String(r.error), /comprovante|prazo/i);
  assert.equal(acerto(id).central_decisao ?? null, null);
});

test("M8, M21 e T4 (a metade do acerto). a Central decide \"vale\": confirmada pela Central; o morador lê a resposta no chamado; os dois são avisados; o termo sai", async () => {
  const { id, chamadoId } = await disputa();
  db.banco.avisos.push({ id: "lem-a", usuario_id: DONO, evento: "caucao_comprovante_lembrete", ref_id: C, prioridade: "critico", titulo: "x", lido_em: null, resolvido_em: null, criado_em: haHoras(1) });
  const r = await decidir({ chamadoId, decisao: "confirmada" });
  assert.equal(r.ok, true, r.error);
  const a = acerto(id);
  assert.equal(a.status, "devolvida_integral");
  assert.equal(a.confirmacao_via, "central");
  assert.ok(a.confirmado_em);
  assert.equal(a.central_decisao, "confirmada");
  assert.ok(a.central_decidido_em, "M36 (a metade do acerto): a decisão fecha a disputa");
  assert.equal(a.central_decidido_por, EQUIPE);
  const texto = m.textoDecisaoConfirmada({ valor: 3200 });
  const visivel = g.__e1248Respostas.find((x) => x.id === chamadoId && !x.interno);
  assert.equal(visivel?.texto, texto, "a resposta visível no chamado do morador");
  assert.ok(db.banco.chamado_mensagens.some((n) => n.chamado_id === chamadoId && n.autor === "admin" && n.interno === true && n.autor_id === EQUIPE), "a nota interna");
  assert.equal(envios("caucao_devolucao_decidida", MORADOR)[0]?.textoAviso, texto);
  assert.equal(envios("caucao_devolucao_decidida", DONO)[0]?.textoAviso, texto);
  assert.deepEqual(g.__e1248Termos, [id]);
  for (const ev of ["caucao_devolucao_contestada", "caucao_comprovante_pedido", "caucao_comprovante_lembrete"]) assert.ok(resolvido(avisos(ev, DONO)[0]), `${ev} do dono sai`);
});

test("M14. a devolução parcial, confirmada pela Central: igual à total", async () => {
  const { id, chamadoId } = await disputa({ valor: 2000 });
  assert.equal((await decidir({ chamadoId, decisao: "confirmada" })).ok, true);
  assert.equal(acerto(id).status, "desconto_confirmado");
  assert.equal(acerto(id).confirmacao_via, "central");
});

test("M9 e M21. a Central decide \"não vale\": continua contestada, com a disputa encerrada; ao dono, a frase a mais e o botão \"Registrar a devolução\"", async () => {
  const { id, chamadoId } = await disputa();
  const r = await decidir({ chamadoId, decisao: "nao_confirmada", motivo: "  O comprovante mostra outro valor.  " });
  assert.equal(r.ok, true, r.error);
  const a = acerto(id);
  assert.equal(a.status, "desconto_contestado");
  assert.equal(a.central_decisao, "nao_confirmada");
  assert.equal(a.central_motivo, "O comprovante mostra outro valor.");
  assert.ok(a.central_decidido_em);
  assert.equal(a.confirmado_em ?? null, null);
  assert.equal(g.__e1248Termos.length, 0, "nenhum termo");
  const motivo = "O comprovante mostra outro valor.";
  assert.equal(envios("caucao_devolucao_decidida", MORADOR)[0]?.textoAviso, m.textoDecisaoNaoConfirmada({ valor: 3200, motivo, paraODono: false }));
  const [d] = envios("caucao_devolucao_decidida", DONO);
  assert.equal(d?.textoAviso, m.textoDecisaoNaoConfirmada({ valor: 3200, motivo, paraODono: true }));
  assert.equal(d?.ctaLabel, "Registrar a devolução");
  assert.equal(d?.pushUrl, URL_DONO);
});

test("8.4-3. \"não confirmada\" com o comprovante: o motivo é obrigatório, com 5 letras", async () => {
  const { id, chamadoId } = await disputa();
  for (const motivo of [undefined, "", "abcd"]) {
    const r = await decidir({ chamadoId, decisao: "nao_confirmada", motivo });
    assert.equal(r.ok, false, JSON.stringify(motivo));
  }
  assert.equal(acerto(id).central_decisao ?? null, null);
});

test("M34 e M40. o prazo do anexo vence sem comprovante: a Central decide; \"não confirmada\" grava o motivo do meio, e os dois são avisados com ele", async () => {
  for (const [meio, motivo] of [
    ["pix", "o comprovante da transferência não foi apresentado no prazo"],
    ["dinheiro", "o recibo do pagamento em dinheiro não foi apresentado no prazo"],
  ] as const) {
    const { id, chamadoId } = await disputa({ comAnexo: false, meio });
    acerto(id).comprovante_pedido_em = haHoras(121);
    const r = await decidir({ chamadoId, decisao: "nao_confirmada" });
    assert.equal(r.ok, true, `${meio}: ${r.error}`);
    assert.equal(acerto(id).central_motivo, motivo, meio);
    assert.equal(envios("caucao_devolucao_decidida", MORADOR)[0]?.textoAviso, m.textoDecisaoNaoConfirmada({ valor: 3200, motivo, paraODono: false }));
    assert.equal(envios("caucao_devolucao_decidida", DONO)[0]?.textoAviso, m.textoDecisaoNaoConfirmada({ valor: 3200, motivo, paraODono: true }));
    db.banco.caucao_acertos = [];
  }
});

test("M10. a segunda decisão sobre o mesmo acerto é recusada", async () => {
  const { id, chamadoId } = await disputa();
  assert.equal((await decidir({ chamadoId, decisao: "nao_confirmada", motivo: "Outro valor." })).ok, true);
  const r = await decidir({ chamadoId, decisao: "confirmada" });
  assert.equal(r.ok, false);
  assert.equal(acerto(id).central_decisao, "nao_confirmada");
  assert.equal(g.__e1248Termos.length, 0);
});

// ——————————————————————————————— a rotina de hora a hora ———————————————————————————————

test("T2 (a metade do acerto) e M5. 5 dias de silêncio: confirmada por falta de resposta, com a hora do fim do prazo; correr duas vezes dá o mesmo", async () => {
  const aviso = "2026-11-20T13:00:00.000Z";
  const id = semearAcerto({ aviso_em: aviso, created_at: "2026-11-20T12:59:00.000Z" });
  db.banco.avisos.push({ id: "reg", usuario_id: MORADOR, evento: "caucao_devolucao_registrada", ref_id: C, prioridade: "normal", titulo: "x", lido_em: null, resolvido_em: null, criado_em: aviso });
  const agora = new Date("2026-11-25T13:30:00.000Z");
  await rodar(agora);
  const a = acerto(id);
  assert.equal(a.status, "devolvida_integral");
  assert.equal(a.confirmacao_via, "falta_de_resposta");
  assert.equal(a.confirmado_em, "2026-11-25T13:00:00.000Z");
  assert.equal(envios("caucao_devolucao_sem_resposta", MORADOR)[0]?.textoAviso, m.textoFimDoPrazoAoMorador({ valor: 3200, registradoEm: "2026-11-20T12:59:00.000Z" }));
  assert.equal(envios("caucao_devolucao_sem_resposta", DONO)[0]?.textoAviso, m.textoFimDoPrazoAoDono({ valor: 3200 }));
  assert.ok(resolvido(avisos("caucao_devolucao_registrada", MORADOR)[0]), "o aviso principal sai");
  const antes = g.__e1248Envios.length;
  await rodar(new Date(agora.getTime() + H));
  assert.equal(acerto(id).confirmado_em, "2026-11-25T13:00:00.000Z");
  assert.equal(g.__e1248Envios.length, antes, "nada sai duas vezes");
  assert.deepEqual(g.__e1248Termos, [id], "um termo só");
});

test("M14. a devolução parcial, confirmada por falta de resposta: igual à total", async () => {
  const id = semearAcerto({ aviso_em: "2026-11-20T13:00:00.000Z", valor_devolvido: 2000, tipo: "desconto" });
  await rodar(new Date("2026-11-26T00:00:00.000Z"));
  assert.equal(acerto(id).status, "desconto_confirmado");
  assert.equal(acerto(id).confirmacao_via, "falta_de_resposta");
});

test("M2 e M13. 4 dias e 23 horas de silêncio: continua à espera (o mesmo relógio do aviso e da tela)", async () => {
  const aviso = "2026-11-20T13:00:00.000Z";
  const id = semearAcerto({ aviso_em: aviso });
  await rodar(new Date(Date.parse(aviso) + (4 * 24 + 23) * H));
  assert.equal(acerto(id).status, "aguardando_confirmacao");
  await rodar(m.fimDoPrazoDeResposta(aviso));
  assert.equal(acerto(id).status, "devolvida_integral", "no fim exato, já confirma");
});

test("M3. o morador responde antes do fim do prazo, com a rotina a correr ao mesmo tempo: vale a resposta dele", async () => {
  const id = semearAcerto({ aviso_em: haHoras(100) });
  como(MORADOR);
  await Promise.all([docs.responderDevolucaoCaucao(id, "confirmar"), rodar(new Date())]);
  assert.equal(acerto(id).confirmacao_via, "morador");
  assert.equal(envios("caucao_devolucao_sem_resposta").length, 0);
  assert.equal(g.__e1248Termos.length, 1);
});

test("M17. faltam menos de 24 horas: o lembrete sai, crítico, uma vez só; o aviso principal continua normal, noutra linha", async () => {
  const aviso = "2026-11-20T13:00:00.000Z";
  const id = semearAcerto({ aviso_em: aviso });
  db.banco.avisos.push({ id: "reg", usuario_id: MORADOR, evento: "caucao_devolucao_registrada", ref_id: C, prioridade: "normal", titulo: "x", lido_em: null, resolvido_em: null, criado_em: aviso });
  const agora = new Date("2026-11-24T14:00:00.000Z");
  await rodar(agora);
  const [e] = envios("caucao_devolucao_lembrete", MORADOR);
  assert.ok(e, "o lembrete");
  assert.equal(e.textoAviso, m.textoLembrete({ valor: 3200, avisoEm: aviso }));
  assert.equal(e.refId, C);
  assert.equal(e.pushUrl, URL_MORADOR);
  assert.ok(acerto(id).lembrete_em);
  const [lem] = avisos("caucao_devolucao_lembrete", MORADOR);
  assert.equal(lem?.prioridade, "critico");
  assert.equal(avisos("caucao_devolucao_registrada", MORADOR)[0].prioridade, "normal", "o principal continua normal");
  await rodar(new Date(agora.getTime() + H));
  assert.equal(envios("caucao_devolucao_lembrete").length, 1, "uma vez só");
  await rodar(new Date("2026-11-25T13:00:00.000Z"));
  assert.ok(resolvido(avisos("caucao_devolucao_lembrete", MORADOR)[0]), "M18: o prazo acaba e o lembrete sai");
});

test("M19. o morador responde antes das últimas 24 horas: o lembrete nunca sai", async () => {
  const aviso = haHoras(30);
  const id = semearAcerto({ aviso_em: aviso });
  como(MORADOR);
  await docs.responderDevolucaoCaucao(id, "confirmar");
  await rodar(new Date(Date.parse(aviso) + 100 * H));
  assert.equal(envios("caucao_devolucao_lembrete").length, 0);
});

test("M33. faltam menos de 24 horas para o fim do prazo do anexo, sem comprovante: o lembrete ao dono, crítico, uma vez só", async () => {
  const pedido = "2026-11-21T13:00:00.000Z";
  semearAcerto({ status: "desconto_contestado", aviso_em: "2026-11-20T13:00:00.000Z", contestado_em: pedido, contestacao_motivo: "Não recebi.", comprovante_pedido_em: pedido });
  const agora = new Date("2026-11-25T14:00:00.000Z");
  await rodar(agora);
  const [e] = envios("caucao_comprovante_lembrete", DONO);
  assert.ok(e, "o lembrete do anexo");
  assert.equal(e.textoAviso, m.textoLembreteDoAnexo({ meio: "pix", valor: 3200, pedidoEm: pedido }));
  assert.equal(e.ctaLabel, "Anexar o comprovante");
  assert.equal(avisos("caucao_comprovante_lembrete", DONO)[0]?.prioridade, "critico");
  await rodar(new Date(agora.getTime() + H));
  assert.equal(envios("caucao_comprovante_lembrete").length, 1, "uma vez só");
});

test("M33. com o comprovante anexado, ou com a decisão tomada, o lembrete do anexo não sai", async () => {
  const pedido = "2026-11-21T13:00:00.000Z";
  semearAcerto({ status: "desconto_contestado", aviso_em: "2026-11-20T13:00:00.000Z", contestado_em: pedido, contestacao_motivo: "Não recebi.", comprovante_pedido_em: pedido, comprovante_path: `${DONO}/a.pdf`, comprovante_anexado_em: pedido });
  semearAcerto({ contrato_id: C2, status: "desconto_contestado", aviso_em: "2026-11-20T13:00:00.000Z", contestado_em: pedido, contestacao_motivo: "Não recebi.", comprovante_pedido_em: pedido, central_decisao: "nao_confirmada", central_decidido_em: pedido, central_motivo: "x" });
  await rodar(new Date("2026-11-25T14:00:00.000Z"));
  assert.equal(envios("caucao_comprovante_lembrete").length, 0);
});

test("M37 (a metade do acerto). o prazo do anexo vence e a equipe ainda não decidiu: a rotina não fecha a disputa", async () => {
  const pedido = "2026-11-21T13:00:00.000Z";
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: "2026-11-20T13:00:00.000Z", contestado_em: pedido, contestacao_motivo: "Não recebi.", comprovante_pedido_em: pedido });
  await rodar(new Date("2026-12-10T00:00:00.000Z"));
  assert.equal(acerto(id).status, "desconto_contestado");
  assert.equal(acerto(id).central_decisao ?? null, null);
  assert.equal(acerto(id).central_decidido_em ?? null, null);
});

// ——————————————————————————————— os sete eventos ———————————————————————————————

const EVENTOS = {
  caucao_devolucao_registrada: { morador: "normal" },
  caucao_devolucao_lembrete: { morador: "critico" },
  caucao_devolucao_contestada: { dono: "normal" },
  caucao_devolucao_sem_resposta: { morador: "normal", dono: "normal" },
  caucao_devolucao_decidida: { morador: "normal", dono: "normal" },
  caucao_comprovante_pedido: { dono: "normal" },
  caucao_comprovante_lembrete: { dono: "critico" },
} as const;

test("os sete eventos próprios: no catálogo, na matriz, na imagem e na prioridade por papel", () => {
  for (const [ev, papeis] of Object.entries(EVENTOS)) {
    const t = (TEMPLATES as Record<string, { subject: string; path: string } | undefined>)[ev];
    assert.ok(t, `${ev} no catálogo`);
    assert.doesNotMatch(t!.subject, /aluguel/i, `${ev}: sem "aluguel"`);
    assert.ok((MATRIZ_NOTIFICACOES as Record<string, unknown>)[ev], `${ev} na matriz`);
    assert.ok((TEMA_POR_EVENTO as Record<string, string>)[ev], `${ev} com imagem`);
    for (const [papel, prio] of Object.entries(papeis)) assert.equal(prioridadeDoAviso(ev as never, papel as never), prio, `${ev} ${papel}`);
  }
});

test("os botões da faixa dos dois lembretes críticos", () => {
  assert.equal(acaoDaFaixa("caucao_devolucao_lembrete"), "Confirmar ou contestar");
  assert.equal(acaoDaFaixa("caucao_comprovante_lembrete"), "Anexar o comprovante");
});

// ——————————————————————— ORDEM-DUET 1359: as duas correções do coordenador ———————————————————————

const servidor2 = servidor as { contestacoesSemChamado?: (admin: unknown) => Promise<{ id: string }[]> };
const m2 = m as unknown as { linhaDaContestacaoSemChamado?: (a: Record<string, unknown>, extra: { teste: boolean }) => Record<string, unknown> };

test("C1. o aviso que falhou: a hora fica vazia; a rotina seguinte reenvia e grava a hora; sem aviso, nunca confirma", async () => {
  g.__e1248FalhaNotify = true;
  const r = await registrar();
  const id = r.id!;
  assert.equal(acerto(id).aviso_em ?? null, null, "o envio falhou: a hora fica vazia");
  // A hora seguinte, com o envio ainda a falhar: nada é gravado.
  const h1 = new Date(Date.now() + H);
  await rodar(h1);
  assert.equal(acerto(id).aviso_em ?? null, null, "outro envio falhado: continua vazia");
  // A hora a seguir, com o envio a dar certo: reenvia e grava a hora desse envio.
  g.__e1248FalhaNotify = false;
  g.__e1248Envios = [];
  const h2 = new Date(Date.now() + 2 * H);
  await rodar(h2);
  assert.equal(acerto(id).aviso_em, h2.toISOString(), "o relógio dos 5 dias começa no envio que deu certo");
  const [e] = envios("caucao_devolucao_registrada", MORADOR);
  assert.ok(e, "o aviso ao morador sai");
  assert.equal(e.textoAviso, m.textoAvisoDoRegistro({ valor: 3200, dataDevolucao: "2026-11-27" }));
  assert.equal(avisos("caucao_devolucao_registrada", MORADOR).filter(aberto).length, 1);
  // Na hora seguinte, já com a hora gravada: não reenvia.
  g.__e1248Envios = [];
  await rodar(new Date(Date.now() + 3 * H));
  assert.equal(envios("caucao_devolucao_registrada").length, 0, "não reenvia");
  assert.equal(acerto(id).aviso_em, h2.toISOString(), "a hora não muda");
  // O prazo conta da hora gravada: 5 vezes 24 horas depois dela, confirma.
  await rodar(new Date(h2.getTime() + 120 * H - 1));
  assert.equal(acerto(id).status, "aguardando_confirmacao");
  await rodar(new Date(h2.getTime() + 120 * H));
  assert.equal(acerto(id).confirmacao_via, "falta_de_resposta");
});

test("C1. um acerto sem aviso nunca confirma por falta de resposta, nem com o envio a falhar sempre", async () => {
  g.__e1248FalhaNotify = true;
  const id = semearAcerto({ aviso_em: null, created_at: haHoras(24 * 30) });
  for (let i = 1; i <= 3; i++) await rodar(new Date(Date.now() + i * 200 * H));
  assert.equal(acerto(id).status, "aguardando_confirmacao");
  assert.equal(acerto(id).aviso_em ?? null, null);
  assert.equal(g.__e1248Termos.length, 0);
});

test("C1. a reenvio grava só onde a hora está vazia (update … where aviso_em is null)", async () => {
  const antes = "2026-11-20T13:00:00.000Z";
  const id = semearAcerto({ aviso_em: antes });
  await rodar(new Date("2026-11-21T13:00:00.000Z"));
  assert.equal(acerto(id).aviso_em, antes, "a hora gravada nunca é substituída");
  assert.equal(envios("caucao_devolucao_registrada").length, 0);
});

test("C2. a abertura do chamado que falha não perde a contestação; a Central vê a linha calculada", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30) });
  g.__e1248FalhaChamado = true;
  const res = await contestar(id, "Não recebi o valor.");
  assert.equal(res.ok, true, "a contestação fica gravada");
  assert.equal(acerto(id).status, "desconto_contestado");
  assert.equal(acerto(id).contestacao_motivo, "Não recebi o valor.");
  assert.equal(acerto(id).chamado_id ?? null, null, "sem chamado");
  assert.equal(typeof servidor2.contestacoesSemChamado, "function", "contestacoesSemChamado existe");
  const sem = await servidor2.contestacoesSemChamado!(db.admin);
  assert.deepEqual(sem.map((x) => x.id), [id], "a leitura da Central acha a contestação sem chamado");
  assert.equal(typeof m2.linhaDaContestacaoSemChamado, "function", "linhaDaContestacaoSemChamado existe");
  const linha = m2.linhaDaContestacaoSemChamado!(sem[0] as unknown as Record<string, unknown>, { teste: false });
  assert.equal(linha.titulo, "Contestação de devolução sem atendimento aberto");
  assert.equal(linha.gravidade, "alta");
  assert.equal((linha.acao as { href: string }).href, `/admin/contratos/${C}`);
});

test("C2. a hora seguinte abre o chamado e grava o chamado_id, sem duplicar; a linha da Central sai", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30) });
  g.__e1248FalhaChamado = true;
  await contestar(id, "Não recebi o valor.");
  g.__e1248FalhaChamado = false;
  // A contestação acabou de acontecer: a rotina espera (a própria ação pode estar a abrir o chamado).
  await rodar(new Date());
  assert.equal(acerto(id).chamado_id ?? null, null, "logo a seguir à contestação, a rotina não abre");
  const depois = new Date(Date.now() + H);
  await rodar(depois);
  const chId = acerto(id).chamado_id as string | null;
  assert.ok(chId, "o chamado nasce na rotina");
  const ch = db.banco.chamados.find((c) => c.id === chId)!;
  assert.equal(ch.usuario_id, MORADOR, "no nome do morador");
  assert.equal(ch.categoria, "caucao", "a fila da caução");
  assert.equal(ch.contexto_tipo, "contrato");
  assert.equal(ch.contexto_id, C);
  const msgs = db.banco.chamado_mensagens.filter((n) => n.chamado_id === chId);
  assert.ok(msgs.some((n) => n.autor === "usuario" && String(n.corpo).includes("Não recebi o valor.") && String(n.corpo).includes(m.NOTA_DA_FASE_PARA_A_EQUIPE)), "o valor, o motivo e a nota da fase");
  assert.ok(msgs.some((n) => n.autor === "sistema" && n.interno === true && n.corpo === `[devolucao] acerto=${id}`), "a nota do acerto");
  assert.ok(g.__e1248AvisosAtendimento.some((a) => a.quem === "equipe" && a.id === chId), "a equipe é avisada");
  assert.equal(ch.prazo_resolucao, calcularPrazos(ch.prioridade as "p2", m.fimDoPrazoDoAnexo(String(acerto(id).comprovante_pedido_em))).resolucao.toISOString(), "sem comprovante: o prazo da decisão começa no fim do prazo do anexo");
  assert.deepEqual(await servidor2.contestacoesSemChamado!(db.admin), [], "a linha da Central sai");
  await rodar(new Date(Date.now() + 2 * H));
  assert.equal(db.banco.chamados.length, 1, "sem duplicar");
  assert.equal(acerto(id).chamado_id, chId);
  const { decidirDevolucaoPelaCentral } = acoes;
  como(DONO);
  assert.equal((await anexar(formulario(id, PDF()))).ok, true);
  como(EQUIPE);
  assert.equal((await decidirDevolucaoPelaCentral!({ chamadoId: chId!, decisao: "confirmada" })).ok, true, "a equipe decide pelo chamado aberto na rotina");
});

test("C2. a rotina grava o chamado_id só onde ele está vazio (update … where chamado_id is null)", async () => {
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: haHoras(30), contestacao_motivo: "Não recebi.", chamado_id: "11111111-1111-4111-8111-111111111111" });
  await rodar(new Date());
  assert.equal(acerto(id).chamado_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(db.banco.chamados.length, 0, "nenhum chamado novo");
});

test("ajuste 2. antes de qualquer contestação, o dono troca o comprovante: o anterior sai do armazenamento", async () => {
  const id = semearAcerto({ aviso_em: haHoras(2) });
  como(DONO);
  assert.equal((await anexar(formulario(id, PDF()))).ok, true);
  const primeiro = String(acerto(id).comprovante_path);
  const r = await anexar(formulario(id, JPG(), "foto.jpg"));
  assert.equal(r.ok, true, r.error);
  const segundo = String(acerto(id).comprovante_path);
  assert.notEqual(segundo, primeiro);
  assert.match(segundo, /\.jpg$/);
  assert.ok(db.arquivos.has(`conferencia/${segundo}`), "o novo fica");
  assert.ok(!db.arquivos.has(`conferencia/${primeiro}`), "o anterior sai do armazenamento");
  assert.equal(db.arquivos.size, 1);
});

test("ajuste 2. depois da contestação, ou do pedido da equipe, o arquivo fica fixo: o segundo anexo é recusado", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30), comprovante_path: `${DONO}/a.pdf`, comprovante_anexado_em: haHoras(20) });
  db.arquivos.set(`conferencia/${DONO}/a.pdf`, PDF());
  await contestar(id);
  como(DONO);
  const r = await anexar(formulario(id, PDF()));
  assert.equal(r.ok, false);
  assert.equal(r.error, "O comprovante desta devolução já foi anexado.");
  assert.equal(acerto(id).comprovante_path, `${DONO}/a.pdf`);
  assert.ok(db.arquivos.has(`conferencia/${DONO}/a.pdf`), "o arquivo da prova não sai");
  const pedido = semearAcerto({ contrato_id: C2, status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: haHoras(30), contestacao_motivo: "Não recebi.", comprovante_pedido_em: haHoras(30) });
  db.banco.contratos.find((c) => c.id === C2)!.properties = { owner_id: DONO, title: "Casa Praia" };
  assert.equal((await anexar(formulario(pedido, PDF()))).ok, true, "na disputa, o primeiro anexo entra");
  assert.equal((await anexar(formulario(pedido, PDF()))).ok, false, "o segundo, não");
});

// ——————————————————————— ORDEM-DUET 1361: o fecho da mordida da Pista 3 ———————————————————————

test("1361-1. o notify real não lança: com os canais a falhar e sem aviso no sino, a hora do aviso não se grava", async () => {
  g.__e1248FalhaNotify = true;
  const r = await registrar();
  assert.equal(r.ok, true);
  assert.equal(envios("caucao_devolucao_registrada", MORADOR).length, 1, "o envio foi tentado");
  assert.equal(acerto(r.id!).aviso_em ?? null, null, "sem prova de envio, nenhuma hora");
});

test("1361-1. o aviso gravado no sino é prova de envio, mesmo com o e-mail a falhar", async () => {
  g.__e1248SoSino = true;
  const r = await registrar();
  assert.ok(acerto(r.id!).aviso_em, "o aviso no sino prova que o morador foi avisado");
  assert.ok(aberto(avisos("caucao_devolucao_registrada", MORADOR)[0]));
});

test("1361-1. sem o morador lido, nenhum envio e nenhuma hora (nem no registro, nem na rotina)", async () => {
  db.banco.contratos.find((c) => c.id === C)!.tenant_id = null;
  const id = semearAcerto({ aviso_em: null });
  await rodar(new Date());
  assert.equal(acerto(id).aviso_em ?? null, null);
  assert.equal(envios("caucao_devolucao_registrada").length, 0);
});

test("1361-1 (D7). um acerto sem aviso, registado há mais de 5 dias, recebe o reenvio e continua à espera", async () => {
  const id = semearAcerto({ aviso_em: null, created_at: haHoras(24 * 6) });
  const agora = new Date();
  await rodar(agora);
  assert.equal(envios("caucao_devolucao_registrada", MORADOR).length, 1, "o reenvio sai");
  assert.equal(acerto(id).aviso_em, agora.toISOString(), "a hora é a do reenvio");
  assert.equal(acerto(id).status, "aguardando_confirmacao", "não confirma: o prazo começa agora");
  await rodar(new Date(agora.getTime() + H));
  assert.equal(acerto(id).status, "aguardando_confirmacao");
  assert.equal(g.__e1248Termos.length, 0);
});

test("1361-3 (D5). a fronteira das 24 horas na leitura do lembrete: no instante exato entra, um milissegundo antes não", async () => {
  const aviso = "2026-11-20T13:00:00.000Z";
  const id = semearAcerto({ aviso_em: aviso });
  const fim = Date.parse("2026-11-25T13:00:00.000Z");
  await rodar(new Date(fim - 24 * H - 1));
  assert.equal(envios("caucao_devolucao_lembrete").length, 0, "antes das últimas 24 horas");
  await rodar(new Date(fim - 24 * H));
  assert.equal(envios("caucao_devolucao_lembrete").length, 1, "a 24 horas exatas do fim");
  assert.ok(acerto(id).lembrete_em);
});

test("1361-3 (D3b). a fronteira das 24 horas na leitura do lembrete do anexo", async () => {
  const pedido = "2026-11-21T13:00:00.000Z";
  semearAcerto({ status: "desconto_contestado", aviso_em: "2026-11-20T13:00:00.000Z", contestado_em: pedido, contestacao_motivo: "Não recebi.", comprovante_pedido_em: pedido });
  const fim = Date.parse("2026-11-26T13:00:00.000Z");
  await rodar(new Date(fim - 24 * H - 1));
  assert.equal(envios("caucao_comprovante_lembrete").length, 0, "antes das últimas 24 horas do anexo");
  await rodar(new Date(fim - 24 * H));
  assert.equal(envios("caucao_comprovante_lembrete").length, 1, "a 24 horas exatas do fim do anexo");
});

test("1361-3 (D16). o chamado com simulacao nula é tratado como simulação (a guarda do E1244)", async () => {
  const { id, chamadoId } = await disputa();
  db.banco.chamados.find((c) => c.id === chamadoId)!.simulacao = null;
  const r = await decidir({ chamadoId, decisao: "confirmada" });
  assert.equal(r.ok, false);
  assert.match(String(r.error), /simulação/);
  assert.equal(acerto(id).central_decisao ?? null, null);
});

test("1361-3 (D16c). um chamado com duas notas de devolução é recusado", async () => {
  const { id, chamadoId } = await disputa();
  const outro = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(30), contestado_em: haHoras(5), contestacao_motivo: "Outro motivo." });
  db.banco.chamado_mensagens.push({ id: "nota2", chamado_id: chamadoId, autor: "sistema", interno: true, corpo: `[devolucao] acerto=${outro}`, criado_em: new Date().toISOString() });
  const r = await decidir({ chamadoId, decisao: "confirmada" });
  assert.equal(r.ok, false);
  assert.match(String(r.error), /mais de uma devolução/);
  assert.equal(acerto(id).central_decisao ?? null, null);
  assert.equal(acerto(outro).central_decisao ?? null, null);
});

test("1361-3 (D19). o anexo só entra com a devolução aberta: num acerto já confirmado, recusado", async () => {
  for (const status of ["devolvida_integral", "desconto_confirmado"]) {
    const id = semearAcerto({ status, aviso_em: haHoras(200), confirmacao_via: "morador", confirmado_em: haHoras(100) });
    como(DONO);
    const r = await anexar(formulario(id, PDF()));
    assert.equal(r.ok, false, status);
    assert.equal(r.error, "Esta devolução já está encerrada: o comprovante não pode ser anexado.", `${status}: recusado antes de subir o arquivo`);
    assert.equal(acerto(id).comprovante_path ?? null, null, status);
  }
  assert.equal(db.arquivos.size, 0);
});

test("1361-3 (D21b). o teto do PDF: acima de 15 MB é recusado pelo tamanho; no teto, passa ao exame do PDF", async () => {
  const id = semearAcerto({ aviso_em: haHoras(2) });
  como(DONO);
  const TETO = 15 * 1024 * 1024;
  const comCabecalho = (n: number) => {
    const b = new Uint8Array(n);
    b.set([0x25, 0x50, 0x44, 0x46], 0);
    return b;
  };
  const acima = await anexar(formulario(id, comCabecalho(TETO + 1)));
  assert.equal(acima.ok, false);
  assert.match(String(acima.error), /até 15 MB/, "recusado pelo tamanho");
  const noTeto = await anexar(formulario(id, comCabecalho(TETO)));
  assert.equal(noTeto.ok, false);
  assert.match(String(noTeto.error), /Não foi possível abrir este PDF/, "no teto, o tamanho passa; o PDF é que não abre");
});

test("1361-3 (D26). o teto de 500 letras do motivo, na ação: 500 entra, 501 é recusado", async () => {
  const longo = semearAcerto({ aviso_em: haHoras(30) });
  const r1 = await contestar(longo, "x".repeat(501));
  assert.equal(r1.ok, false);
  assert.match(String(r1.error), /motivo/);
  assert.equal(acerto(longo).status, "aguardando_confirmacao");
  const certo = semearAcerto({ contrato_id: C2, aviso_em: haHoras(30) });
  db.banco.contratos.find((c) => c.id === C2)!.tenant_id = MORADOR;
  const r2 = await contestar(certo, "x".repeat(500));
  assert.equal(r2.ok, true, r2.error);
  assert.equal(String(acerto(certo).contestacao_motivo).length, 500);
});

test("1361-4 (D35). a confirmação por falta de resposta grava com a condição de estado: o morador que confirmou no mesmo instante ganha", async () => {
  const id = semearAcerto({ aviso_em: "2026-11-20T13:00:00.000Z" });
  // Entre a leitura e a escrita da rotina, o morador confirma.
  db.antesDe("caucao_acertos", "update", (b) => Object.assign(b.caucao_acertos.find((a) => a.id === id)!, { status: "devolvida_integral", confirmacao_via: "morador", confirmado_em: "2026-11-25T12:59:59.000Z" }));
  await rodar(new Date("2026-11-25T14:00:00.000Z"));
  assert.equal(acerto(id).confirmacao_via, "morador", "a confirmação do morador não é reescrita");
  assert.equal(acerto(id).confirmado_em, "2026-11-25T12:59:59.000Z");
  assert.equal(envios("caucao_devolucao_sem_resposta").length, 0, "nenhum aviso de falta de resposta");
  assert.equal(g.__e1248Termos.length, 0, "a rotina não emite o termo de quem não confirmou");
});

test("1361-4 (D20). o anexo não grava fora do estado aberto: o acerto confirmado entre a leitura e a escrita não recebe o arquivo", async () => {
  const id = semearAcerto({ aviso_em: haHoras(2) });
  db.antesDe("caucao_acertos", "update", (b) => Object.assign(b.caucao_acertos.find((a) => a.id === id)!, { status: "devolvida_integral", confirmacao_via: "morador", confirmado_em: new Date().toISOString() }));
  como(DONO);
  const r = await anexar(formulario(id, PDF()));
  assert.equal(r.ok, false);
  assert.equal(acerto(id).comprovante_path ?? null, null);
  assert.equal(db.arquivos.size, 0, "o arquivo enviado sai do armazenamento");
});

test("1361-4 (D20b). o anexo não grava depois de a Central decidir", async () => {
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: haHoras(30), contestacao_motivo: "Não recebi.", comprovante_pedido_em: haHoras(30) });
  db.antesDe("caucao_acertos", "update", (b) => Object.assign(b.caucao_acertos.find((a) => a.id === id)!, { central_decisao: "nao_confirmada", central_decidido_em: new Date().toISOString(), central_motivo: "sem prova" }));
  como(DONO);
  const r = await anexar(formulario(id, PDF()));
  assert.equal(r.ok, false);
  assert.equal(acerto(id).comprovante_path ?? null, null);
  assert.equal(db.arquivos.size, 0);
});

test("1361-4 (D34). o lembrete do morador não se repete: gravado por outra passagem entre a leitura e a escrita, não sai de novo", async () => {
  const id = semearAcerto({ aviso_em: "2026-11-20T13:00:00.000Z" });
  db.antesDe("caucao_acertos", "update", (b) => Object.assign(b.caucao_acertos.find((a) => a.id === id)!, { lembrete_em: "2026-11-24T13:30:00.000Z" }));
  await rodar(new Date("2026-11-24T14:00:00.000Z"));
  assert.equal(envios("caucao_devolucao_lembrete").length, 0, "a outra passagem já o mandou");
  assert.equal(acerto(id).lembrete_em, "2026-11-24T13:30:00.000Z");
});

test("1361 (Z47). o canal que entregou é prova de envio, mesmo com o aviso do sino a falhar", async () => {
  db.falhas.add("avisos:insert");
  const r = await registrar();
  assert.ok(acerto(r.id!).aviso_em, "o e-mail entregou: a hora grava-se");
  assert.equal(avisos("caucao_devolucao_registrada", MORADOR).length, 0, "o sino falhou");
});

test("1361 (Z39). o reenvio não grava por cima da hora gravada por outra passagem entre a leitura e a escrita", async () => {
  const id = semearAcerto({ aviso_em: null });
  db.antesDe("caucao_acertos", "update", (b) => Object.assign(b.caucao_acertos.find((a) => a.id === id)!, { aviso_em: "2026-11-28T10:00:00.000Z" }));
  await rodar(new Date("2026-11-28T11:00:00.000Z"));
  assert.equal(acerto(id).aviso_em, "2026-11-28T10:00:00.000Z", "a hora da outra passagem fica");
});

test("1361 (Z40) e 1363-3. o chamado aberto pela rotina não toma o lugar do que a ação ligou; o que chegou tarde é fechado, com a nota", async () => {
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: haHoras(30), contestacao_motivo: "Não recebi o valor." });
  const daAcao = "22222222-2222-4222-8222-222222222222";
  db.banco.chamados.push({ id: daAcao, numero_publico: "CH-2026-000777", contexto_tipo: "contrato", contexto_id: C, simulacao: false, status: "aberto", prioridade: "p2" });
  // A rotina insere o seu chamado e a nota; antes de o ligar, a ação liga o dela.
  db.antesDe("caucao_acertos", "update", (b) => Object.assign(b.caucao_acertos.find((a) => a.id === id)!, { chamado_id: daAcao }));
  await rodar(new Date());
  assert.equal(acerto(id).chamado_id, daAcao, "fica o da ação");
  const tarde = db.banco.chamados.find((c) => c.id !== daAcao)!;
  assert.ok(tarde, "a rotina abriu o seu");
  assert.equal(tarde.status, "encerrado", "o que chegou tarde é fechado");
  const notas = db.banco.chamado_mensagens.filter((n) => n.chamado_id === tarde.id && n.autor === "sistema" && n.interno === true);
  assert.ok(notas.some((n) => n.corpo === "aberto em duplicado; a contestação está no chamado CH-2026-000777"), "a nota interna diz onde está a contestação");
  assert.equal(g.__e1248Respostas.filter((r) => r.id === tarde.id).length, 0, "ninguém responde ao morador por ele");
  como(EQUIPE);
  const r = await decidir({ chamadoId: String(tarde.id), decisao: "confirmada" });
  assert.equal(r.ok, false, "o chamado que chegou tarde nunca decide");
});

test("Lab da 7bddfdef0. a prova pelo sino não depende do relógio do banco: com o banco atrasado, o aviso gravado prova o envio", async () => {
  db.relogio.atrasoMs = 5_000;
  g.__e1248SoSino = true;
  const r = await registrar();
  assert.equal(avisos("caucao_devolucao_registrada", MORADOR).length, 1, "o aviso foi gravado (com a hora do banco)");
  assert.ok(acerto(r.id!).aviso_em, "o aviso no sino prova o envio, qualquer que seja o relógio do banco");
});

test("Lab da 7bddfdef0. um aviso antigo, por resolver, não é prova de um envio novo que falhou", async () => {
  db.banco.avisos.push({ id: "antigo", usuario_id: MORADOR, evento: "caucao_devolucao_registrada", ref_id: C, prioridade: "normal", titulo: "x", lido_em: null, resolvido_em: null, criado_em: new Date(Date.now() + 60_000).toISOString() });
  g.__e1248FalhaNotify = true;
  const r = await registrar();
  assert.equal(acerto(r.id!).aviso_em ?? null, null, "o aviso de antes não conta");
});

// ——————————————————————— ORDEM-DUET 1363: o ponto (B) — a nota antes da ligação ———————————————————————

test("1363-1. a nota que falha deixa o acerto sem ligação e a linha da Central à vista; a hora seguinte liga", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30) });
  db.falhas.add("chamado_mensagens:insert");
  const res = await contestar(id, "Não recebi o valor.");
  assert.equal(res.ok, true, "a contestação fica gravada");
  assert.equal(acerto(id).status, "desconto_contestado");
  assert.equal(acerto(id).chamado_id ?? null, null, "sem a nota, nada se liga");
  assert.deepEqual((await servidor2.contestacoesSemChamado!(db.admin)).map((x) => x.id), [id], "a linha da Central continua à vista");
  db.falhas.delete("chamado_mensagens:insert");
  await rodar(new Date(Date.now() + H));
  const chId = acerto(id).chamado_id as string | null;
  assert.ok(chId, "a hora seguinte liga");
  assert.ok(db.banco.chamado_mensagens.some((n) => n.chamado_id === chId && n.autor === "sistema" && n.corpo === `[devolucao] acerto=${id}`), "com a nota");
  assert.deepEqual(await servidor2.contestacoesSemChamado!(db.admin), [], "a linha sai");
});

test("1363-1. na rotina, a nota que falha também não liga; a hora seguinte tenta de novo", async () => {
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: haHoras(30), contestacao_motivo: "Não recebi o valor." });
  // A rotina grava duas mensagens do chamado (a do morador e a do prazo) e depois a nota: falha só a nota.
  let n = 0;
  const original = db.admin.from;
  db.admin.from = ((t: string) => {
    const q = original(t) as Record<string, unknown>;
    if (t !== "chamado_mensagens") return q;
    const inserir = q.insert as (v: unknown) => unknown;
    q.insert = (v: unknown) => {
      const ehNota = !Array.isArray(v) && String((v as { corpo?: string }).corpo ?? "").startsWith("[devolucao]");
      if (ehNota && n++ === 0) return { then: (ok: (x: unknown) => unknown) => Promise.resolve({ data: null, error: { code: "XX000", message: "falha forçada" } }).then(ok) };
      return inserir(v);
    };
    return q;
  }) as typeof db.admin.from;
  await rodar(new Date());
  assert.equal(acerto(id).chamado_id ?? null, null, "sem a nota, nada se liga");
  await rodar(new Date(Date.now() + H));
  assert.ok(acerto(id).chamado_id, "a hora seguinte liga");
  db.admin.from = original;
});

test("1363-2. a decisão exige acerto.chamado_id = chamado.id: um chamado com a nota de um acerto ligado a outro chamado é recusado", async () => {
  const { id, chamadoId } = await disputa();
  const outro = globalThis.crypto.randomUUID();
  db.banco.chamados.push({ id: outro, numero_publico: "CH-2026-000888", contexto_tipo: "contrato", contexto_id: C, simulacao: false, status: "aberto", prioridade: "p2" });
  db.banco.chamado_mensagens.push({ id: "nota-outro", chamado_id: outro, autor: "sistema", interno: true, corpo: `[devolucao] acerto=${id}`, criado_em: new Date().toISOString() });
  const r = await decidir({ chamadoId: outro, decisao: "confirmada" });
  assert.equal(r.ok, false);
  assert.match(String(r.error), /não é o da contestação/);
  assert.equal(acerto(id).central_decisao ?? null, null);
  assert.equal((await decidir({ chamadoId, decisao: "confirmada" })).ok, true, "pelo chamado ligado, decide");
});

// ——————————————————————— ORDEM-DUET 1365: as fugas da mordida ao delta ———————————————————————

test("1365 (N5b). o reenvio não toca acertos já respondidos: sem 'Confirme ou conteste' e sem hora do aviso", async () => {
  const ids = [
    semearAcerto({ status: "devolvida_integral", aviso_em: null, confirmacao_via: "morador", confirmado_em: haHoras(2) }),
    semearAcerto({ status: "desconto_contestado", aviso_em: null, contestado_em: haHoras(2), contestacao_motivo: "Não recebi o valor.", chamado_id: "33333333-3333-4333-8333-333333333333" }),
  ];
  await rodar(new Date());
  assert.equal(envios("caucao_devolucao_registrada").length, 0, "nenhum 'Confirme ou conteste'");
  for (const id of ids) assert.equal(acerto(id).aviso_em ?? null, null, "nenhuma hora do aviso");
});

test("1365 (N5b). o morador que responde entre a leitura e a escrita do reenvio: a hora do aviso não se grava", async () => {
  const id = semearAcerto({ aviso_em: null });
  db.antesDe("caucao_acertos", "update", (b) => Object.assign(b.caucao_acertos.find((a) => a.id === id)!, { status: "devolvida_integral", confirmacao_via: "morador", confirmado_em: new Date().toISOString() }));
  await rodar(new Date());
  assert.equal(acerto(id).aviso_em ?? null, null);
});

test("1365 (N16). no chamado aberto pela rotina, com o comprovante já anexado, o prazo da decisão conta da hora do anexo", async () => {
  const pedido = haHoras(40);
  const anexado = haHoras(20);
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: pedido, contestacao_motivo: "Não recebi o valor.", comprovante_pedido_em: pedido, comprovante_path: `${DONO}/a.pdf`, comprovante_anexado_em: anexado });
  await rodar(new Date());
  const ch = db.banco.chamados.find((c) => c.id === acerto(id).chamado_id)!;
  assert.ok(ch, "o chamado abre");
  assert.equal(ch.prazo_resolucao, calcularPrazos(ch.prioridade as "p2", new Date(anexado)).resolucao.toISOString());
});

test("1365 (N10b). o chamado que a rotina abre pede uma pessoa", async () => {
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: haHoras(30), contestacao_motivo: "Não recebi o valor." });
  await rodar(new Date());
  const chId = acerto(id).chamado_id;
  assert.ok(chId);
  const eventos = (db.banco.chamado_eventos ?? []).filter((e) => e.chamado_id === chId);
  assert.ok(eventos.some((e) => e.acao === "pediu_humano"), "o \"Falar com uma pessoa\"");
  const ch = db.banco.chamados.find((c) => c.id === chId)!;
  assert.equal(ch.responsavel_tipo, "humano");
});

test("1365 (N9). à marca exata dos 10 minutos a rotina ainda não abre o chamado; abre depois dela", async () => {
  const agora = new Date();
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: new Date(agora.getTime() - 10 * 60_000).toISOString(), contestacao_motivo: "Não recebi o valor." });
  await rodar(agora);
  assert.equal(acerto(id).chamado_id ?? null, null, "aos 10 minutos exatos, ainda não");
  await rodar(new Date(agora.getTime() + 1));
  assert.ok(acerto(id).chamado_id, "um milissegundo depois, abre");
});

// ——————————————————————— ORDEM-DUET 1367: a Dúvida 9 — o chamado do morador, órfão quando a nota falha ———————————————————————

test("1367. a nota falhou na ação: a rotina liga o chamado aberto do próprio morador, em vez de abrir outro", async () => {
  const id = semearAcerto({ aviso_em: haHoras(30) });
  db.falhas.add("chamado_mensagens:insert");
  await contestar(id, "Não recebi o valor.");
  db.falhas.delete("chamado_mensagens:insert");
  assert.equal(acerto(id).chamado_id ?? null, null);
  assert.equal(db.banco.chamados.length, 1, "o chamado do morador existe, sem ligação");
  const doMorador = db.banco.chamados[0];
  await rodar(new Date(Date.now() + H));
  assert.equal(acerto(id).chamado_id, doMorador.id, "liga o do morador");
  assert.equal(db.banco.chamados.length, 1, "um só chamado por devolução");
  assert.ok(db.banco.chamado_mensagens.some((n) => n.chamado_id === doMorador.id && n.autor === "sistema" && n.corpo === `[devolucao] acerto=${id}`), "com a nota");
  assert.equal(doMorador.status, "aberto", "não é fechado");
  como(DONO);
  assert.equal((await anexar(formulario(id, PDF()))).ok, true);
  como(EQUIPE);
  assert.equal((await decidir({ chamadoId: String(doMorador.id), decisao: "confirmada" })).ok, true, "é o do morador que decide");
});

// ORDEM-DUET 1368 (a condição do coordenador): a busca é ESTRITA — do morador, neste contrato, na fila da caução, aberto,
// sem outro acerto ligado, e criado a partir de contestado_em (1 minuto de folga) ou já com a nota deste acerto.
// Exatamente um candidato → liga; nenhum ou mais de um → abre um novo e não toca nos outros.
const contestacaoParaRotina = () => {
  const contestadoEm = haHoras(30);
  const id = semearAcerto({ status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: contestadoEm, contestacao_motivo: "Não recebi o valor." });
  return { id, contestadoEm };
};
const chamadoDoMorador = (extra: Linha) => ({ id: globalThis.crypto.randomUUID(), usuario_id: MORADOR, categoria: "caucao", assunto: "qualquer", status: "aberto", contexto_tipo: "contrato", contexto_id: C, simulacao: false, prioridade: "p2", ...extra });

test("1368. um chamado de manutenção do morador no mesmo contrato nunca é ligado", async () => {
  const { id, contestadoEm } = contestacaoParaRotina();
  const manut = chamadoDoMorador({ categoria: "manutencao", contexto_tipo: "manutencao", criado_em: contestadoEm });
  const manutNoContrato = chamadoDoMorador({ categoria: "manutencao", criado_em: contestadoEm });
  db.banco.chamados.push(manut, manutNoContrato);
  await rodar(new Date());
  assert.ok(acerto(id).chamado_id);
  assert.ok(![manut.id, manutNoContrato.id].includes(acerto(id).chamado_id as string), "nenhum de manutenção");
  assert.equal(db.banco.chamado_mensagens.filter((n) => [manut.id, manutNoContrato.id].includes(n.chamado_id as string)).length, 0, "e não se toca neles");
});

test("1368. com dois candidatos, a rotina abre um novo e não toca nos dois", async () => {
  const { id, contestadoEm } = contestacaoParaRotina();
  const a1 = chamadoDoMorador({ criado_em: contestadoEm });
  const a2 = chamadoDoMorador({ criado_em: new Date(Date.parse(contestadoEm) + 1000).toISOString() });
  db.banco.chamados.push(a1, a2);
  await rodar(new Date());
  const chId = acerto(id).chamado_id as string;
  assert.ok(chId && ![a1.id, a2.id].includes(chId), "abriu um novo");
  assert.equal(db.banco.chamado_mensagens.filter((n) => [a1.id, a2.id].includes(n.chamado_id as string)).length, 0, "não tocou nos dois");
  assert.equal(a1.status, "aberto");
  assert.equal(a2.status, "aberto");
});

test("1368. não são candidatos: criado antes da contestação (além do minuto de folga), fechado, resolvido, ligado a outro acerto, de outra pessoa, de outro contrato", async () => {
  const { id, contestadoEm } = contestacaoParaRotina();
  const t = Date.parse(contestadoEm);
  const ligadoAOutro = chamadoDoMorador({ criado_em: contestadoEm });
  semearAcerto({ contrato_id: C2, status: "desconto_contestado", aviso_em: haHoras(60), contestado_em: haHoras(30), contestacao_motivo: "Outro.", chamado_id: ligadoAOutro.id });
  const naoServem = [
    chamadoDoMorador({ criado_em: new Date(t - 61_000).toISOString() }),
    chamadoDoMorador({ criado_em: contestadoEm, status: "encerrado" }),
    chamadoDoMorador({ criado_em: contestadoEm, status: "resolvido" }),
    ligadoAOutro,
    chamadoDoMorador({ criado_em: contestadoEm, usuario_id: OUTRO }),
    chamadoDoMorador({ criado_em: contestadoEm, contexto_id: C2 }),
  ];
  db.banco.chamados.push(...naoServem);
  await rodar(new Date());
  const chId = acerto(id).chamado_id as string;
  assert.ok(chId && !naoServem.some((c) => c.id === chId), "abriu um novo");
});

test("1368. a folga de 1 minuto: criado até 1 minuto antes de contestado_em ainda é candidato", async () => {
  const { id, contestadoEm } = contestacaoParaRotina();
  const quase = chamadoDoMorador({ criado_em: new Date(Date.parse(contestadoEm) - 60_000).toISOString() });
  db.banco.chamados.push(quase);
  await rodar(new Date());
  assert.equal(acerto(id).chamado_id, quase.id);
});

test("1368. o chamado antigo que já tem a nota deste acerto é candidato", async () => {
  const { id } = contestacaoParaRotina();
  const comNota = chamadoDoMorador({ criado_em: haHoras(500) });
  db.banco.chamados.push(comNota);
  db.banco.chamado_mensagens.push({ id: "nota-velha", chamado_id: comNota.id, autor: "sistema", interno: true, corpo: `[devolucao] acerto=${id}`, criado_em: haHoras(500) });
  await rodar(new Date());
  assert.equal(acerto(id).chamado_id, comNota.id);
});

test("1368 (R3). o único chamado do morador para a contestação, mas já encerrado ou resolvido, não é ligado", async () => {
  for (const status of ["encerrado", "resolvido"]) {
    db.banco.chamados = [];
    db.banco.caucao_acertos = [];
    const { id, contestadoEm } = contestacaoParaRotina();
    const fechado = chamadoDoMorador({ criado_em: contestadoEm, status });
    db.banco.chamados.push(fechado);
    await rodar(new Date());
    assert.ok(acerto(id).chamado_id, status);
    assert.notEqual(acerto(id).chamado_id, fechado.id, `${status}: não liga`);
  }
});

// ——————————————————————— ORDEM-DUET 1369: a fuga B4 ———————————————————————

test("1369 (B4). a escrita do chamado_id que falha não é 'chegou tarde': o chamado continua aberto, sem a nota de duplicado; a hora seguinte liga", async () => {
  const { id, contestadoEm } = contestacaoParaRotina();
  const doMorador = chamadoDoMorador({ criado_em: contestadoEm });
  db.banco.chamados.push(doMorador);
  // A escrita do chamado_id falha uma vez (a única escrita em caucao_acertos desta passagem).
  const original = db.admin.from;
  let falhou = false;
  db.admin.from = ((t: string) => {
    const q = original(t) as Record<string, unknown>;
    if (t !== "caucao_acertos" || falhou) return q;
    const atualizar = q.update as (v: Record<string, unknown>) => unknown;
    q.update = (v: Record<string, unknown>) => {
      if ("chamado_id" in v && !falhou) {
        falhou = true;
        const erro = { data: null, error: { code: "XX000", message: "falha forçada" } };
        const fim: Record<string, unknown> = { then: (ok: (x: unknown) => unknown) => Promise.resolve(erro).then(ok) };
        for (const k of ["eq", "is", "in", "select"]) fim[k] = () => fim;
        return fim;
      }
      return atualizar(v);
    };
    return q;
  }) as typeof db.admin.from;
  await rodar(new Date());
  db.admin.from = original;
  assert.ok(falhou, "a escrita foi tentada e falhou");
  assert.equal(acerto(id).chamado_id ?? null, null, "nada se liga");
  assert.equal(doMorador.status, "aberto", "o chamado do morador continua aberto");
  assert.equal(db.banco.chamado_mensagens.filter((n) => n.chamado_id === doMorador.id && String(n.corpo).startsWith("aberto em duplicado")).length, 0, "sem a nota de duplicado");
  assert.equal(db.banco.chamados.length, 1, "nenhum chamado novo");
  await rodar(new Date(Date.now() + H));
  assert.equal(acerto(id).chamado_id, doMorador.id, "a hora seguinte liga o mesmo");
});
