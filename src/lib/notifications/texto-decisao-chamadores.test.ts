/*
  44-SITE, item 2 (texto da decisão no push): o #1162 deixou as frases de visita e manutenção prontas, mas os
  chamadores não passavam os dados — o push saía com o texto genérico. Guarda: todo evento com frase de decisão tem
  chamador que passa `decisao`, e o texto sai com o imóvel e o prazo.
  Roda: node --test src/lib/notifications/texto-decisao-chamadores.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoDaDecisao } from "./regra-push.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

const CHAMADORES: Record<string, { arquivo: string; trecho: RegExp }> = {
  proposta_vencendo: { arquivo: "src/app/api/cron/automacoes/route.ts", trecho: /tipo: "proposta_vencendo",[\s\S]{0,600}?decisao: \{ imovel:[\s\S]{0,120}?prazo: p\.valida_ate/ },
  visita_pedida: { arquivo: "src/lib/data/visitas-video-actions.ts", trecho: /"visita_pedida",[\s\S]{0,400}?\{ imovel: \(prop\?\.title[\s\S]{0,80}?prazo: \[\.\.\.v\.horarios\]\.sort\(\)\[0\]/ },
  visita_remarcada: { arquivo: "src/lib/data/visitas-video-actions.ts", trecho: /"visita_remarcada",[\s\S]{0,300}?prazo: campos\.horario_proposto/ },
  manutencao_nova: { arquivo: "src/lib/atendimento/servidor.ts", trecho: /event: "manutencao_nova",[\s\S]{0,600}?decisao: \{ imovel:[\s\S]{0,120}?prazo: prazoManutencao\(/ },
  manutencao_atrasada: { arquivo: "src/app/api/cron/atendimento/route.ts", trecho: /event: "manutencao_atrasada",[\s\S]{0,300}?decisao: \{ imovel: so\.properties\?\.title/ },
};

test("todo evento com frase de decisão tem chamador passando `decisao` (imóvel e, quando há, prazo)", () => {
  const regra = ler("src/lib/notifications/regra-push.ts");
  const frases = [...regra.slice(regra.indexOf("const FRASE"), regra.indexOf("};", regra.indexOf("const FRASE"))).matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1]);
  assert.ok(frases.length >= 6);
  for (const e of frases) {
    if (e === "proposta_recebida") continue; // ligado desde o #1162 (propostas-actions)
    const c = CHAMADORES[e];
    assert.ok(c, `evento ${e} tem frase mas nenhum chamador conferido aqui`);
    assert.match(ler(c.arquivo), c.trecho, `${e}: ${c.arquivo} não passa decisao`);
  }
});

test("a visita repassa `decisao` ao notify; o valor nunca vai (não há valor em visita nem manutenção)", () => {
  const visitas = ler("src/lib/data/visitas-video-actions.ts");
  assert.match(visitas, /\.\.\.\(decisao \? \{ decisao \} : \{\}\)/);
  for (const c of Object.values(CHAMADORES)) assert.doesNotMatch(ler(c.arquivo).match(c.trecho)![0], /valor:/);
});

test("o texto sai com o imóvel e o prazo, e sem prazo quando já venceu", () => {
  const agora = new Date("2026-10-24T15:00:00Z");
  const base = { imovel: "Apto Santa Mônica", destinatarioEhParte: true };
  assert.equal(textoDaDecisao("visita_pedida", { ...base, prazo: "2026-10-25T13:00:00Z" }, agora), "Pedido de visita para o Apto Santa Mônica: responda até amanhã");
  assert.equal(textoDaDecisao("visita_remarcada", { ...base, prazo: "2026-10-24T20:00:00Z" }, agora), "Visita com novo horário para o Apto Santa Mônica: responda até hoje");
  assert.equal(textoDaDecisao("manutencao_nova", { ...base, prazo: "2026-10-28T15:00:00Z" }, agora), "Nova manutenção para o Apto Santa Mônica: responda até 28/10");
  assert.equal(textoDaDecisao("manutencao_atrasada", base, agora), "Manutenção atrasada para o Apto Santa Mônica");
  assert.equal(textoDaDecisao("proposta_vencendo", { ...base, prazo: "2026-10-25T10:00:00Z" }, agora), "Proposta vencendo para o Apto Santa Mônica: responda até amanhã");
});
