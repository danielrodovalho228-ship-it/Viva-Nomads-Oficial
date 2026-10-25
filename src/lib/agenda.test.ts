import test from "node:test";
import assert from "node:assert/strict";
import { agruparPorDia, diaBrasilia, diasDoItem, filtrarPorImovel, gradeDoMes, horaBrasilia, moverMes, type ItemAgenda } from "./agenda.ts";

const item = (p: Partial<ItemAgenda>): ItemAgenda => ({ id: "x", tipo: "visita", propertyId: "a", imovel: "Studio", quando: "2026-10-20", href: null, ...p });

test("p23 agenda — o dia é o de Brasília (visita às 22h30 de Brasília não vira o dia seguinte)", () => {
  // 21/10 01:30 UTC = 20/10 22:30 em Brasília.
  assert.equal(diaBrasilia("2026-10-21T01:30:00Z"), "2026-10-20");
  assert.equal(horaBrasilia("2026-10-21T01:30:00Z"), "22:30");
  // Data pura (entrada/saída/bloqueio) não muda de dia por fuso.
  assert.equal(diaBrasilia("2026-10-20"), "2026-10-20");
  assert.equal(horaBrasilia("2026-10-20"), null);
});

test("p23 agenda — bloqueio ocupa todos os dias; filtro por imóvel", () => {
  assert.deepEqual(diasDoItem(item({ tipo: "bloqueio", quando: "2026-10-30", ate: "2026-11-02" })), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  const itens = [item({ id: "1", propertyId: "a" }), item({ id: "2", propertyId: "b" })];
  assert.deepEqual(filtrarPorImovel(itens, "b").map((i) => i.id), ["2"]);
  assert.equal(filtrarPorImovel(itens, null).length, 2);
});

test("p23 agenda — no dia: saída, entrada, visitas pela hora, bloqueio", () => {
  const dia = agruparPorDia([
    item({ id: "v2", tipo: "visita", quando: "2026-10-20T18:00:00Z" }),
    item({ id: "b", tipo: "bloqueio", quando: "2026-10-20", ate: "2026-10-20" }),
    item({ id: "v1", tipo: "visita", quando: "2026-10-20T13:00:00Z" }),
    item({ id: "e", tipo: "entrada", quando: "2026-10-20" }),
    item({ id: "s", tipo: "saida", quando: "2026-10-20" }),
  ]).get("2026-10-20")!;
  assert.deepEqual(dia.map((i) => i.id), ["s", "e", "v1", "v2", "b"]);
});

test("p23 agenda — grade do mês de domingo a sábado; navegação entre meses", () => {
  const out = gradeDoMes(2026, 10); // 01/10/2026 é quinta
  assert.equal(out[0][0].dia, "2026-09-27");
  assert.equal(out[0][4].dia, "2026-10-01");
  assert.ok(out.every((s) => s.length === 7));
  assert.ok(out.flat().filter((d) => d.doMes).length === 31);
  assert.deepEqual(moverMes(2026, 12, 1), { ano: 2027, mes: 1 });
  assert.deepEqual(moverMes(2026, 1, -1), { ano: 2025, mes: 12 });
});

// AGENDA-A (E83)
import { acaoDoDia, conflitoComEstadia, estadoDoDia, LEGENDA_AGENDA, mesTemItens, tituloDoMes, visitaAConfirmar } from "./agenda.ts";
import { readFileSync } from "node:fs";

test("AGENDA-A — bloqueio de 5 dias pinta os 5 (também com o fim vindo com hora)", () => {
  const b = item({ id: "b", tipo: "bloqueio", quando: "2026-10-10", ate: "2026-10-14" });
  const porDia = agruparPorDia([b]);
  const dias = ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"];
  for (const d of dias) assert.equal(estadoDoDia(porDia.get(d), d).bloqueios.length, 1, d);
  assert.equal(porDia.get("2026-10-15"), undefined);
  assert.deepEqual(diasDoItem(item({ tipo: "bloqueio", quando: "2026-10-10", ate: "2026-10-14T00:00:00+00:00" })), dias);
});

test("AGENDA-A — contrato pinta o período inteiro, com entrada no 1º dia e saída no último", () => {
  const e = item({ id: "estadia-c", tipo: "estadia", quando: "2026-10-28", ate: "2026-11-03", pessoa: { nome: "Ana", fotoUrl: null } });
  const porDia = agruparPorDia([e]);
  const dias = diasDoItem(e);
  assert.equal(dias.length, 7);
  for (const d of dias) assert.equal(estadoDoDia(porDia.get(d), d).estadias.length, 1, d);
  assert.deepEqual(estadoDoDia(porDia.get("2026-10-28"), "2026-10-28").estadias[0], { item: e, entrada: true, saida: false });
  assert.deepEqual(estadoDoDia(porDia.get("2026-10-31"), "2026-10-31").estadias[0], { item: e, entrada: false, saida: false });
  assert.deepEqual(estadoDoDia(porDia.get("2026-11-03"), "2026-11-03").estadias[0], { item: e, entrada: false, saida: true });
});

test("AGENDA-A — ação do dia: estadia nunca bloqueia; sem imóvel pede para escolher; livre bloqueia; bloqueado desbloqueia", () => {
  const hoje = "2026-10-20";
  const e = item({ id: "estadia-c", tipo: "estadia", quando: "2026-10-22", ate: "2026-10-25" });
  const b = item({ id: "bloqueio-1", tipo: "bloqueio", quando: "2026-10-27", ate: "2026-10-28" });
  const porDia = agruparPorDia([e, b]);
  const est = (d: string) => estadoDoDia(porDia.get(d), d);
  assert.equal(acaoDoDia(est("2026-10-23"), "2026-10-23", hoje, true), "estadia");
  assert.equal(acaoDoDia(est("2026-10-23"), "2026-10-23", hoje, false), "estadia");
  assert.equal(acaoDoDia(est("2026-10-21"), "2026-10-21", hoje, false), "escolher-imovel");
  assert.equal(acaoDoDia(est("2026-10-21"), "2026-10-21", hoje, true), "bloquear");
  assert.equal(acaoDoDia(est("2026-10-28"), "2026-10-28", hoje, true), "desbloquear");
  assert.equal(acaoDoDia(est("2026-10-10"), "2026-10-10", hoje, true), "passado");
});

test("AGENDA-A — o período a bloquear recusa encostar numa estadia do mesmo imóvel", () => {
  const e = item({ id: "estadia-c", tipo: "estadia", propertyId: "a", quando: "2026-10-22", ate: "2026-10-25" });
  assert.equal(conflitoComEstadia([e], "a", "2026-10-18", "2026-10-21"), null);
  assert.equal(conflitoComEstadia([e], "a", "2026-10-20", "2026-10-23"), "2026-10-22");
  assert.equal(conflitoComEstadia([e], "b", "2026-10-20", "2026-10-23"), null, "outro imóvel não conflita");
});

test("AGENDA-A — visita a confirmar (pedida ou com outro horário proposto); legenda; título; mês vazio", () => {
  assert.equal(visitaAConfirmar(item({ tipo: "visita", status: "pedido" })), true);
  assert.equal(visitaAConfirmar(item({ tipo: "visita", status: "remarcar" })), true);
  assert.equal(visitaAConfirmar(item({ tipo: "visita", status: "confirmado" })), false);
  assert.deepEqual([...LEGENDA_AGENDA], ["Estadia", "Entrada", "Saída", "Bloqueado", "Visita", "Visita a confirmar"]);
  assert.equal(tituloDoMes(2026, 10), "Outubro de 2026");
  assert.equal(tituloDoMes(2027, 3), "Março de 2027");
  const porDia = agruparPorDia([item({ quando: "2026-10-20" })]);
  assert.equal(mesTemItens(porDia, 2026, 10), true);
  assert.equal(mesTemItens(porDia, 2026, 11), false);
});

test("AGENDA-A — a tela usa as MESMAS ações (addBlock/removeBlock e responderVisita), sem capitalize nem confirm do navegador", () => {
  const acoes = readFileSync(new URL("../app/(dashboard)/dashboard/agenda/acoes-do-dia.tsx", import.meta.url), "utf8");
  const cliente = readFileSync(new URL("../app/(dashboard)/dashboard/agenda/agenda-client.tsx", import.meta.url), "utf8");
  assert.match(acoes, /import \{ addBlock, removeBlock \} from "@\/lib\/data\/blocks-actions"/);
  assert.match(acoes, /import \{ responderVisita, type AcaoVisita \} from "@\/lib\/data\/visitas-video-actions"/);
  assert.match(cliente, /<ImportarCalendario /);
  assert.match(cliente, /<ExportarCalendario /);
  assert.doesNotMatch(cliente, /\bcapitalize\b/);
  assert.doesNotMatch(acoes + cliente, /window\.(confirm|alert)/);
  assert.doesNotMatch(acoes + cliente, /Nada marcado neste dia/);
});
