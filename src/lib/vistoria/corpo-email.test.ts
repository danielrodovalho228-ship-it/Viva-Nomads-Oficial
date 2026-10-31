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
  assert.equal(c.body("Lara"), "Olá Lara, a visita de avaliação de Apto Santa Mônica é amanhã, 05/11/2026 às 10:00 (horário de Brasília). Se precisar mudar, avise pelas mensagens da Viva.");
});

test("designado ao dono: o nome público do avaliador; ausência: a visita que não aconteceu", () => {
  const d = corpoVistoria("vistoria_designado_dono", { imovel: IMOVEL, avaliador: "Rui Avalia" });
  assert.equal(d.subject, "O avaliador de Apto Santa Mônica foi designado");
  assert.match(d.body("Lara"), /^Olá Lara, a Viva designou Rui Avalia, avaliador credenciado, para a avaliação de Apto Santa Mônica\./);
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
  assert.equal(n, 23);
  const srv = arquivos[1];
  assert.match(srv, /select\("property_id, agendado_para, avaliadores_credenciamento\(parceiros\(nome_publico\)\)"\)/);
  assert.match(srv, /corpoVistoria\(ev as EventoVistoria, await fatosDaVistoria\(admin, ref\)\)/);
});
