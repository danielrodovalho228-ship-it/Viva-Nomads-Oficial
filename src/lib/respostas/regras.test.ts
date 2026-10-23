/* Prompt 55-E2 — respostas rápidas e mensagens programadas. Roda: node --test src/lib/respostas/regras.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITE_RESPOSTAS,
  MSG_CONTATO_BLOQUEADO,
  MSG_LIMITE_RESPOSTAS,
  datasDaEstadia,
  decidirEnvio,
  enviarEm,
  reagendar,
  respostasDaConversa,
  rotuloHorario,
  temContato,
  validarResposta,
} from "./regras.ts";

test("filtro de contato ao SALVAR: telefone, e-mail, WhatsApp, @ e CPF bloqueiam (não mascaram)", () => {
  for (const t of ["Me chama no (34) 99876-5432", "manda para ana@gmail.com", "wa.me/5534998765432", "no insta @ana.casa", "meu CPF 529.982.247-25"]) {
    const v = validarResposta({ titulo: "Chegada", texto: t }, 0);
    assert.deepEqual(v, { ok: false, erro: MSG_CONTATO_BLOQUEADO }, t);
  }
  assert.equal(validarResposta({ titulo: "Zap 34998765432", texto: "Oi" }, 0).ok, false, "título também passa pelo filtro");
  const ok = validarResposta({ titulo: "  Chegada  ", texto: " O check-in é a partir das 14h, CEP 38400-000. " }, 3);
  assert.deepEqual(ok, { ok: true, valor: { titulo: "Chegada", texto: "O check-in é a partir das 14h, CEP 38400-000." } });
});

test("até 20 respostas salvas; editar uma não conta como nova", () => {
  assert.deepEqual(validarResposta({ titulo: "A", texto: "B" }, LIMITE_RESPOSTAS), { ok: false, erro: MSG_LIMITE_RESPOSTAS });
  assert.equal(validarResposta({ titulo: "A", texto: "B" }, LIMITE_RESPOSTAS, true).ok, true);
  assert.equal(validarResposta({ titulo: "", texto: "B" }, 0).ok, false);
  assert.equal(validarResposta({ titulo: "A", texto: "x".repeat(1001) }, 0).ok, false);
});

test("a mensagem do anúncio (61-B) é a primeira resposta, com o mesmo filtro", () => {
  const salvas = [{ id: "r1", titulo: "Chegada", texto: "Check-in às 14h." }];
  const r = respostasDaConversa(salvas, "  Conte quem vai morar e por quanto tempo.  ");
  assert.deepEqual(r.map((x) => x.id), ["anuncio", "r1"]);
  assert.equal(r[0].texto, "Conte quem vai morar e por quanto tempo.");
  assert.equal(r[0].doAnuncio, true);
  assert.deepEqual(respostasDaConversa(salvas, "Me liga 34 99876-5432").map((x) => x.id), ["r1"], "com contato: fica fora");
  assert.deepEqual(respostasDaConversa(salvas, null).map((x) => x.id), ["r1"]);
});

test("filtro ao ENVIAR: o texto com contato não sai nem pela programada", () => {
  assert.equal(temContato("Oi, tudo certo para amanhã?"), false);
  assert.equal(temContato("liga 34998765432"), true);
  const agora = new Date("2026-11-10T13:00:00Z"); // 10h em Brasília
  const p = { enviar_em: "2026-11-10T13:00:00Z", enviada_em: null, cancelada_em: null, texto: "liga 34998765432" };
  assert.deepEqual(decidirEnvio(p, true, agora), { acao: "cancelar", motivo: "contato" });
});

const datas = datasDaEstadia([
  { inicio: "2026-11-17", fim: "2026-12-16", status: "ativo" },
  { inicio: "2026-12-17", fim: "2027-01-15", status: "pendente_aceite" },
  { inicio: "2027-01-16", fim: "2027-02-14", status: "nao_aceito" },
])!;

test("horários: D-7 às 10h, entrada e saída às 9h (Brasília); renovação recusada fora", () => {
  assert.deepEqual(datas, { entrada: "2026-11-17", saida: "2027-01-15" });
  assert.equal(enviarEm("7_dias_antes", datas).toISOString(), "2026-11-10T13:00:00.000Z");
  assert.equal(enviarEm("entrada", datas).toISOString(), "2026-11-17T12:00:00.000Z");
  assert.equal(enviarEm("saida", datas).toISOString(), "2027-01-15T12:00:00.000Z");
  assert.equal(enviarEm("7_dias_antes", { entrada: "2026-12-03", saida: "2027-01-01" }).toISOString(), "2026-11-26T13:00:00.000Z", "virada de mês");
  assert.equal(rotuloHorario("2026-11-10T13:00:00.000Z"), "ter., 10/11 às 10h");
});

test("nunca envia entre 22h e 7h: espera as 7h; antes da hora espera; depois de 1 dia não envia atrasado", () => {
  const p = { enviar_em: "2026-11-17T12:00:00Z", enviada_em: null, cancelada_em: null, texto: "Bom dia!" };
  assert.deepEqual(decidirEnvio(p, true, new Date("2026-11-17T11:59:00Z")), { acao: "esperar" });
  assert.deepEqual(decidirEnvio(p, true, new Date("2026-11-17T12:05:00Z")), { acao: "enviar" });
  // Atrasada (cron parado) e o tique cai às 23h e às 3h de Brasília: espera.
  for (const h of ["2026-11-18T02:00:00Z", "2026-11-18T06:00:00Z", "2026-11-18T09:59:00Z"]) {
    assert.deepEqual(decidirEnvio(p, true, new Date(h)), { acao: "esperar" }, h);
  }
  assert.deepEqual(decidirEnvio(p, true, new Date("2026-11-18T10:00:00Z")), { acao: "enviar" }, "7h: sai");
  assert.deepEqual(decidirEnvio(p, true, new Date("2026-11-18T12:01:00Z")), { acao: "cancelar", motivo: "vencida" });
  // Varredura das 24 horas: nada sai no silêncio.
  for (let m = 0; m < 24 * 60; m += 15) {
    const agora = new Date(Date.parse("2026-11-17T12:00:00Z") + m * 60_000);
    const hora = new Date(agora.getTime() - 3 * 3_600_000).getUTCHours();
    if (decidirEnvio(p, true, agora).acao === "enviar") assert.ok(hora >= 7 && hora < 22, `enviou às ${hora}h`);
  }
});

test("contrato encerrado cancela; enviada ou cancelada não muda", () => {
  const p = { enviar_em: "2026-11-17T12:00:00Z", enviada_em: null, cancelada_em: null, texto: "Bom dia!" };
  assert.deepEqual(decidirEnvio(p, false, new Date("2026-11-01T12:00:00Z")), { acao: "cancelar", motivo: "contrato_encerrado" });
  assert.deepEqual(decidirEnvio({ ...p, enviada_em: "2026-11-17T12:00:00Z" }, false, new Date()), { acao: "nada" });
  assert.deepEqual(decidirEnvio({ ...p, cancelada_em: "2026-11-01T12:00:00Z" }, true, new Date()), { acao: "nada" });
});

test("aditivo que muda as datas reagenda só o que não saiu", () => {
  const linhas = [
    { id: "a", quando: "7_dias_antes" as const, enviar_em: "2026-11-10T13:00:00.000Z", enviada_em: "2026-11-10T13:00:00Z", cancelada_em: null, texto: "x" },
    { id: "b", quando: "entrada" as const, enviar_em: "2026-11-17T12:00:00.000Z", enviada_em: null, cancelada_em: null, texto: "x" },
    { id: "c", quando: "saida" as const, enviar_em: "2027-01-15T12:00:00.000Z", enviada_em: null, cancelada_em: null, texto: "x" },
    { id: "d", quando: "saida" as const, enviar_em: "2027-01-15T12:00:00.000Z", enviada_em: null, cancelada_em: "2026-11-01T00:00:00Z", texto: "x" },
  ];
  // Aditivo: entrada vai para 20/11, mais um mês no fim (saída 14/02).
  assert.deepEqual(reagendar(linhas, { entrada: "2026-11-20", saida: "2027-02-14" }), [
    { id: "b", enviar_em: "2026-11-20T12:00:00.000Z" },
    { id: "c", enviar_em: "2027-02-14T12:00:00.000Z" },
  ]);
  assert.deepEqual(reagendar(linhas, datas), [], "mesmas datas: nada muda");
});
