/*
  E1248 PR 1 — o relógio da máquina da devolução da caução (ESPEC-E1248 v11, secções 2.2, 2.3, 2.7 e 8.2; ORDEM-DUET
  1355). Regras PURAS, uma função só para cada prazo:
   - o prazo de resposta do morador: 5 vezes 24 horas, contados da hora do AVISO (M2, M13, M22);
   - o lembrete das últimas 24 horas (M17, M19);
   - o prazo do anexo do comprovante: 5 vezes 24 horas do PEDIDO, e o lembrete dele (M32, M33);
   - a hora anunciada "DD/MM HH:MM", em Brasília;
   - os textos do coordenador (8.2), com o valor e as datas.
  Roda: node --test src/lib/caucao/e1248-relogio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";

const m = (await import("./devolucao-maquina.ts").catch(() => ({}))) as Record<string, (...a: never[]) => unknown>;
const f = <T>(nome: string) => {
  assert.equal(typeof m[nome], "function", `${nome} existe`);
  return m[nome] as unknown as T;
};
const H = 3_600_000;
const AVISO = "2026-12-01T13:00:00.000Z"; // 01/12 10:00 em Brasília

test("M13. o prazo de resposta: 5 vezes 24 horas da hora do aviso — uma função só", () => {
  const fim = f<(a: string | Date) => Date>("fimDoPrazoDeResposta")(AVISO);
  assert.equal(fim.toISOString(), "2026-12-06T13:00:00.000Z");
  assert.equal(f<(d: Date) => string>("horaAnunciada")(fim), "06/12 10:00", "a hora anunciada, em Brasília");
});

test("M2 e M22. a fronteira: 4 dias e 23 horas ainda espera; no fim exato e depois, o prazo terminou", () => {
  const terminou = f<(a: string, agora: Date) => boolean>("prazoDeRespostaTerminou");
  const fim = Date.parse("2026-12-06T13:00:00.000Z");
  assert.equal(terminou(AVISO, new Date(Date.parse(AVISO) + (4 * 24 + 23) * H)), false, "4 dias e 23 horas");
  assert.equal(terminou(AVISO, new Date(fim - 1)), false, "um milissegundo antes");
  assert.equal(terminou(AVISO, new Date(fim)), true, "no fim exato");
  assert.equal(terminou(AVISO, new Date(fim + 1000)), true, "às 10:00:01 (a trava do coordenador)");
});

test("M17 e M19. o lembrete: só nas últimas 24 horas antes do fim do prazo", () => {
  const janela = f<(a: string, agora: Date) => boolean>("naJanelaDoLembrete");
  const fim = Date.parse("2026-12-06T13:00:00.000Z");
  assert.equal(janela(AVISO, new Date(fim - 24 * H - 1)), false, "antes das últimas 24 horas");
  assert.equal(janela(AVISO, new Date(fim - 24 * H)), true, "a 24 horas do fim");
  assert.equal(janela(AVISO, new Date(fim - 1)), true, "um milissegundo antes do fim");
  assert.equal(janela(AVISO, new Date(fim)), false, "no fim, já não");
});

test("M32 e M33. o prazo do anexo: 5 vezes 24 horas do pedido, e o lembrete dele nas últimas 24 horas", () => {
  const fim = f<(p: string | Date) => Date>("fimDoPrazoDoAnexo")("2026-12-03T18:30:00.000Z");
  assert.equal(fim.toISOString(), "2026-12-08T18:30:00.000Z");
  const janela = f<(p: string, agora: Date) => boolean>("naJanelaDoLembreteDoAnexo");
  assert.equal(janela("2026-12-03T18:30:00.000Z", new Date(fim.getTime() - 24 * H - 1)), false);
  assert.equal(janela("2026-12-03T18:30:00.000Z", new Date(fim.getTime() - H)), true);
  assert.equal(janela("2026-12-03T18:30:00.000Z", fim), false);
});

const T = (nome: string) => f<(d: Record<string, unknown>) => string>(nome);
test("8.2. os textos do coordenador, com o valor, as datas e a hora do mesmo relógio", () => {
  assert.equal(
    T("textoAvisoDoRegistro")({ valor: 3200, dataDevolucao: "2026-11-28" }),
    "O proprietário registrou a devolução da caução: R$ 3.200,00, em 28/11/2026. Confirme ou conteste em até 5 dias; sem resposta, a devolução vale como confirmada.",
  );
  assert.equal(
    T("textoLembrete")({ valor: 3200, avisoEm: AVISO }),
    "Faltam menos de 24 horas para você confirmar ou contestar a devolução da caução de R$ 3.200,00. Sem resposta, ela vale como confirmada em 06/12 10:00.",
  );
  assert.equal(T("textoRespostaTardia")({ avisoEm: AVISO }), "O prazo para responder terminou em 06/12 10:00; a devolução valeu como confirmada.");
  assert.equal(
    T("textoContestacaoAoDono")({ valor: 3200, motivo: "Não recebi o valor." }),
    "O morador contestou a devolução da caução de R$ 3.200,00. Motivo: Não recebi o valor.. A equipe da Viva vai analisar, e o seu prazo fica suspenso até a decisão.",
  );
  assert.equal(
    T("textoFimDoPrazoAoMorador")({ valor: 3200, registradoEm: "2026-12-01T13:00:00.000Z" }),
    "A devolução da caução de R$ 3.200,00, registrada pelo proprietário em 01/12/2026, foi considerada confirmada porque não houve resposta em 5 dias.",
  );
  assert.equal(T("textoFimDoPrazoAoDono")({ valor: 3200 }), "A devolução da caução de R$ 3.200,00 foi considerada confirmada: o morador não respondeu em 5 dias.");
  assert.equal(T("textoDecisaoConfirmada")({ valor: 3200 }), "A equipe da Viva analisou a contestação e confirmou a devolução da caução de R$ 3.200,00.");
  assert.equal(
    T("textoDecisaoNaoConfirmada")({ valor: 3200, motivo: "o comprovante da transferência não foi apresentado no prazo", paraODono: false }),
    "A equipe da Viva analisou a contestação e não confirmou a devolução da caução de R$ 3.200,00. Motivo: o comprovante da transferência não foi apresentado no prazo.",
  );
  assert.equal(
    T("textoDecisaoNaoConfirmada")({ valor: 3200, motivo: "o comprovante da transferência não foi apresentado no prazo", paraODono: true }),
    "A equipe da Viva analisou a contestação e não confirmou a devolução da caução de R$ 3.200,00. Motivo: o comprovante da transferência não foi apresentado no prazo. Registre a devolução correta para concluir.",
  );
  assert.equal(f<() => string>("linhaDoDonoNaDisputa")(), "A equipe da Viva está analisando. O seu prazo fica suspenso até a decisão.");
});

test("1361-3 (D3b, D3c). as fronteiras exatas do anexo: a janela abre às 24 horas exatas; o prazo termina no fim exato", () => {
  const pedido = "2026-12-03T18:30:00.000Z";
  const fim = Date.parse("2026-12-08T18:30:00.000Z");
  const janela = f<(p: string, agora: Date) => boolean>("naJanelaDoLembreteDoAnexo");
  const terminou = f<(p: string, agora: Date) => boolean>("prazoDoAnexoTerminou");
  assert.equal(janela(pedido, new Date(fim - 24 * H)), true, "a 24 horas exatas do fim");
  assert.equal(janela(pedido, new Date(fim - 24 * H - 1)), false);
  assert.equal(terminou(pedido, new Date(fim)), true, "no fim exato, terminou");
  assert.equal(terminou(pedido, new Date(fim - 1)), false, "um milissegundo antes, não");
});
