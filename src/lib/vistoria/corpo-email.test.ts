/*
  E289 (grupo 2) — os 14 e-mails da avaliação de imóvel com os fatos do caso. Roda: node --test src/lib/vistoria/corpo-email.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoVistoria, EVENTOS_VISTORIA_COM_FATOS, type EventoVistoria } from "./corpo-email.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";
import { comMarca, problemasDoAssunto } from "../notifications/assuntos.ts";

const IMOVEL = { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
// 05/11/2026 10:00 em Brasília.
const VISITA = "2026-11-05T13:00:00Z";

test("agendada: imóvel e data/hora da visita no assunto, no corpo e no bloco", () => {
  const c = corpoVistoria("vistoria_agendada", { imovel: IMOVEL, visita: VISITA });
  assert.equal(c.subject, "Visita de avaliação: Apto Santa Mônica, 05/11 às 10:00");
  assert.equal(c.body("Lara"), "Olá Lara, a visita de avaliação de Apto Santa Mônica está agendada para 05/11/2026 às 10:00 (horário de Brasília). Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso.");
  assert.deepEqual(c.linhas, [
    { rotulo: "Imóvel", valor: "Apto Santa Mônica · Santa Mônica, Uberlândia" },
    { rotulo: "Visita", valor: "05/11/2026 às 10:00 (horário de Brasília)" },
  ]);
});

test("concordância (morador): a data proposta e o imóvel; o resto da regra continua", () => {
  const c = corpoVistoria("vistoria_concordancia", { imovel: IMOVEL, visita: VISITA });
  assert.equal(c.subject, "Concorda com a visita de avaliação em 05/11 às 10:00?");
  assert.equal(c.body("Ana"), "Olá Ana, o proprietário pediu a avaliação de Apto Santa Mônica, imóvel onde você mora, com a visita proposta para 05/11/2026 às 10:00 (horário de Brasília). A visita só acontece se você concordar com a data. O avaliador não fotografa os seus pertences.");
  assert.deepEqual(c.linhas.at(-1), { rotulo: "Data proposta", valor: "05/11/2026 às 10:00 (horário de Brasília)" });
});

test("lembrete (véspera): o horário no assunto e a data completa no corpo", () => {
  const c = corpoVistoria("vistoria_lembrete", { imovel: IMOVEL, visita: VISITA });
  assert.equal(c.subject, "Visita de avaliação amanhã às 10:00: Apto Santa Mônica");
  // E1160 (5) (asserção alterada, ORDEM-DUET-674): o convite a mudar saiu de todos os lembretes. A regra do reagendamento
  // só entra para o dono e para o avaliador, e o morador lê um corpo próprio — na trava do E1160.
  assert.equal(c.body("Lara"), "Olá Lara, a visita de avaliação de Apto Santa Mônica é amanhã, 05/11/2026 às 10:00 (horário de Brasília).");
});

test("designado ao dono: o nome público do avaliador; ausência: a visita que não aconteceu", () => {
  const d = corpoVistoria("vistoria_designado_dono", { imovel: IMOVEL, avaliador: "Rui Avalia" });
  // E1160 (1) (asserções alteradas, ORDEM-DUET-674): este aviso é só o da proposta que chegou; a recusa e a falta de
  // resposta ganharam cada uma o seu evento (trava do E1160).
  assert.equal(d.subject, "Proposta de avaliação recebida: Apto Santa Mônica");
  assert.match(d.body("Lara"), /^Olá Lara, Rui Avalia, avaliador credenciado que você escolheu, enviou a proposta de valor e prazo para a avaliação de Apto Santa Mônica\./);
  assert.deepEqual(d.linhas.at(-1), { rotulo: "Avaliador", valor: "Rui Avalia" });
  const a = corpoVistoria("vistoria_ausencia", { imovel: IMOVEL, visita: VISITA });
  assert.match(a.body("Lara"), /a visita de avaliação de Apto Santa Mônica em 05\/11\/2026 às 10:00 \(horário de Brasília\) não aconteceu por ausência/);
});

test("todos os 14: o imóvel nomeado no corpo; assunto dentro da régua (70, sem número longo, maiúscula)", () => {
  const longo = { titulo: "apartamento enorme com vista para o mar e varanda gourmet 1201", bairro: "Centro", cidade: "Uberlândia" };
  for (const ev of EVENTOS_VISTORIA_COM_FATOS) {
    for (const imovel of [IMOVEL, longo]) {
      const c = corpoVistoria(ev as EventoVistoria, { imovel, visita: VISITA, avaliador: "Rui Avalia" });
      assert.ok(c.subject, ev);
      assert.deepEqual(problemasDoAssunto(comMarca(c.subject!)), [], `${ev}: "${c.subject}"`);
    }
    const c = corpoVistoria(ev as EventoVistoria, { imovel: IMOVEL, visita: VISITA, avaliador: "Rui Avalia" });
    assert.ok(c.body("Lara").includes("Apto Santa Mônica"), ev);
    assert.notEqual(c.body("Lara"), TEMPLATES[ev as EventoVistoria].body("Lara"), ev);
    assert.doesNotMatch([c.subject, c.body("Lara")].join(" "), /comiss[ãa]o|aluguel/i, ev);
  }
});

test("sem dado (imóvel apagado, sem visita): frase inteira, sem 'undefined'; o assunto volta ao do modelo", () => {
  for (const ev of EVENTOS_VISTORIA_COM_FATOS) {
    const c = corpoVistoria(ev as EventoVistoria, { imovel: null });
    assert.equal(c.subject, null, ev);
    for (const s of [c.body(), c.body("Lara")]) assert.doesNotMatch(s, /undefined|null|NaN|—|\s{2}| ,|\.\./, `${ev}: "${s}"`);
    assert.deepEqual(c.linhas, []);
  }
});

test("ponto de envio: todo avisar() da avaliação passa a referência (pedido ou imóvel) para os fatos", () => {
  const arquivos = ["actions.ts", "servidor.ts", "laudo-actions.ts", "laudo-servidor.ts"].map((f) => readFileSync(`src/lib/vistoria/${f}`, "utf8"));
  let n = 0;
  for (const txt of arquivos) {
    for (const linha of txt.split("\n").filter((l) => /\bawait avisar\(/.test(l))) {
      assert.match(linha, /, \{ (pedidoId|propertyId)[:,} ]/, linha.trim());
      n++;
    }
  }
  // E1142 (asserção alterada, ORDEM-DUET-622): 26 → 27. O ponto novo é o aviso ao avaliador quando a proposta dele vence
  // sem o aceite do dono (decisão do Daniel); também passa a referência, como os outros.
  // E1173 (asserção alterada, ORDEM-DUET-753): 27 → 29. Os dois pontos novos são o aviso da recusa da data, ao dono e
  // ao avaliador; os dois passam a referência (e a data recusada).
  // E1177 (asserção alterada, ORDEM-DUET-778): 29 → 30. O ponto novo é o aviso ao dono quando a lista de avaliadores
  // abre ou chega outro avaliador; também passa a referência, como os outros.
  assert.equal(n, 30);
  const srv = arquivos[1];
  // E1084 (asserção alterada): o select leva também o user_id do parceiro — o nome do avaliador vem da conta (fonte única).
  // E1160 (asserção alterada, ORDEM-DUET-674): o select leva também o que os corpos novos afirmam — a proposta, se há
  // avaliador para escolher, as marcas de reagendamento e o número de credenciado.
  // E1177 (asserção alterada, ORDEM-DUET-778): o select leva também o motivo da espera — o e-mail diz por que não há
  // avaliador para escolher.
  // E1188 (asserção alterada, ORDEM-DUET-852): o select leva também o valor e os prazos do laudo da proposta — o e-mail
  // diz os mesmos fatos da tela; e só o aviso do laudo emitido pede também o laudo.
  assert.match(srv, /select\("property_id, agendado_para, proposta_em, valor_proposto, prazo_proposto_dias, prazo_laudo_dias_uteis, aguardando_avaliador, motivo_da_espera, reagendou_dono, reagendou_avaliador, avaliadores_credenciamento\(numero_credenciado, parceiros\(nome_publico, user_id\)\)"\)/);
  assert.match(srv, /corpoVistoria\(ev as EventoVistoria, await fatosDaVistoria\(admin, ref, \{ comLaudo: ev === "vistoria_laudo_emitido" \}\)\)/);
});
