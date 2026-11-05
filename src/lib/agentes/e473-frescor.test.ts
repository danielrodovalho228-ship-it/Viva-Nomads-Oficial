/*
  E473 (AD4) — a Central de Agentes se dizia "Ao vivo" com dados de 17/10: o selo bastava UMA ronda recente (a do
  Renato, de hora em hora) para chamar a central inteira de "Ao vivo", enquanto 13 agentes ativos estavam parados desde
  17/10 (produção, 05/11). Os cartões diziam "Em espera" e a aba se chamava "Rede ao vivo".
  Correção (rótulo honesto de frescor): "Ao vivo" só quando TODOS os agentes que fazem ronda rodaram na janela; com
  parte parada, o selo diz quantos estão em dia e há quanto tempo os outros pararam; o cartão do agente parado diz
  "Parado" (a linha "Última" já mostra "há X dias"); a aba vira "Rede (24 h)", que é o que ela mostra.
  Roda: node --test src/lib/agentes/e473-frescor.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JANELA_AO_VIVO_MS, estadoDaCentral } from "./selo-vivo.ts";
import { JANELA_PARADO_MS, ROTULO_STATUS, statusDoAgente } from "./central.ts";
import { ABAS_AGENTES } from "../admin/agentes-abas.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const agora = new Date("2026-11-05T07:00:00Z");
const atras = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();
const ativo = (slug: string) => ({ slug, status: "ativo" as const });

test("o caso do QA: só o Renato em dia, os outros desde 17/10 → nunca 'Ao vivo'; o selo diz quantos e há quanto tempo", () => {
  const e = estadoDaCentral({
    acessoLiberado: true,
    agentes: [ativo("renato"), ativo("luana"), ativo("sergio"), { slug: "rita", status: "planejado" }],
    rondas: [
      { agente_slug: "renato", iniciada_em: atras(5) },
      { agente_slug: "luana", iniciada_em: "2026-10-17T10:48:03Z" },
      { agente_slug: "sergio", iniciada_em: "2026-10-17T10:44:15Z" },
    ],
    agora,
  });
  assert.equal(e.tipo, "parcial");
  assert.equal(e.selo, "1 de 3 agentes com ronda nas últimas 2 h · os outros parados (última ronda há 19 dias)");
});

test("todos em dia → 'Ao vivo'; nenhum em dia → a última ronda; planejado e sem ronda não contam", () => {
  const todos = estadoDaCentral({
    acessoLiberado: true,
    agentes: [ativo("renato"), ativo("moacir"), { slug: "rita", status: "planejado" }],
    rondas: [{ agente_slug: "renato", iniciada_em: atras(5) }, { agente_slug: "moacir", iniciada_em: atras(JANELA_AO_VIVO_MS / 60_000) }],
    agora,
  });
  assert.equal(todos.tipo, "ao_vivo");
  const nenhum = estadoDaCentral({ acessoLiberado: true, agentes: [ativo("luana")], rondas: [{ agente_slug: "luana", iniciada_em: atras(3 * 24 * 60) }], agora });
  assert.deepEqual([nenhum.tipo, nenhum.selo], ["parado", "Última ronda há 3 dias"]);
});

test("cartão: ativo com última ronda velha diz 'Parado'; recente segue 'Em espera'/'Alerta'", () => {
  assert.equal(ROTULO_STATUS.parado, "Parado");
  const a = { status: "ativo" as const, trigger_id: "trig_x", slug: "luana" };
  assert.equal(statusDoAgente(a, { status: "ok", iniciada_em: "2026-10-17T10:48:03Z" }, agora), "parado");
  assert.equal(statusDoAgente(a, { status: "alerta", iniciada_em: atras(30) }, agora), "alerta");
  assert.equal(statusDoAgente(a, { status: "ok", iniciada_em: new Date(agora.getTime() - JANELA_PARADO_MS + 60_000).toISOString() }, agora), "espera");
  assert.equal(statusDoAgente(a, { status: "ok", iniciada_em: "2026-10-17T10:48:03Z" }), "espera", "sem relógio, o comportamento antigo");
});

test("a tela: selo de frescor, cartão com o relógio, aba 'Rede (24 h)'", () => {
  assert.ok((ABAS_AGENTES as readonly string[]).includes("Rede (24 h)"));
  assert.ok(!(ABAS_AGENTES as readonly string[]).includes("Rede ao vivo"));
  const tela = ler("src/app/(dashboard)/admin/agentes/central-client.tsx");
  assert.match(tela, /const st = statusDoAgente\(a, ultima, agora \?\? undefined\);/);
  assert.match(tela, /aba === "Rede \(24 h\)"/);
});
