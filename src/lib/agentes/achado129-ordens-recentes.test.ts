/*
  Frente 1, rodada 4 — achado 129 (média-baixa): "Executar agora" na Central de Agentes confere as ordens das
  últimas 2 h para não criar (nem disparar) a mesma ordem duas vezes. A leitura dessas ordens engolia o erro
  (lista vazia) e o motor ainda trocava a falha por []: a ordem repetida era criada e a rotina disparada de novo,
  gastando um disparo. Agora a leitura LANÇA e o motor recusa com "tente de novo", sem criar nem disparar.
  Roda: node --test src/lib/agentes/achado129-ordens-recentes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executarAgora, type DepsExecutar } from "./motor.ts";

const AG = { slug: "renato", nome: "Renato", cargo: "C", esquadrao: "tecnologia", rotina_texto: "x", trigger_id: "trig_renato", status: "ativo", briefing: "b", ordem: 1 };

test("ordens recentes não lidas: nada criado, nada disparado, nenhum disparo gasto", async () => {
  const log: string[] = [];
  const d: DepsExecutar = {
    adminId: async () => "admin-1",
    agentes: async () => [AG] as never,
    consumirDisparo: async () => (log.push("consumiu"), true),
    criarOrdem: async () => (log.push("ordem"), "o1"),
    ordensRecentes: async () => {
      throw new Error("falha de leitura");
    },
    registrarDisparo: async () => void log.push("registrou"),
    token: () => "tok",
    disparar: async () => (log.push("disparou"), { sessao_url: null }),
  };
  const r = await executarAgora(d, { slug: "renato", texto: "corrija X" });
  assert.equal(r.status, 503);
  assert.match(String(r.body.erro), /Tente de novo/);
  assert.deepEqual(log, []);
});

test("servidor: a leitura das ordens recentes lança na falha (não devolve lista vazia)", () => {
  const src = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async ordensRecentes(slug)"), src.indexOf("async registrarDisparo("));
  assert.match(fn, /const \{ data, error \} = await supabase\.from\("agentes_ordens"\)/);
  assert.match(fn, /if \(error\) throw new Error/);
});
