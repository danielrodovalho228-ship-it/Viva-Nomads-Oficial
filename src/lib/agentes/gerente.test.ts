/*
  Moacir gerente: investiga (banco ao vivo), pergunta pelo organograma, dispara
  quem faz e responde no formato. Roda: node --test src/lib/agentes/gerente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { investigar, modeloGerenteSimulado, nomeDoOrganograma, ORGANOGRAMA, systemGerente, type DepsGerente, type ModeloGerente } from "./gerente.ts";
import { responderChat, type Deps } from "./motor.ts";
import type { Agente } from "./central.ts";

const CHAMADOS = "Chamados abertos (dados de 07/10 18:40, horário de Brasília) — mais novos primeiro:\nVN-000101 · caucao · P2 · aberto · com a equipe · aberto 07/10 14:57; prazo 1ª resposta 08/10 02:57; sem resposta ainda; SLA ok";

function fakeDeps(over: Partial<DepsGerente> = {}) {
  const chamadas: string[] = [];
  const d: DepsGerente = {
    nomeDe: (s) => ({ viva: "Viva", renato: "Renato", bruno: "Bruno" })[s] ?? s,
    consultar: async (c) => (chamadas.push(`consultar:${c}`), c === "chamados_abertos" ? CHAMADOS : "ok"),
    perguntarAgente: async (s, q) => (chamadas.push(`perguntar:${s}:${q}`), { nome: "Viva", resposta: "Tenho 1 chamado aberto: VN-000101 (Caução), com o Daniel." }),
    executar: async (s, o) => (chamadas.push(`executar:${s}:${o}`), { ok: true, texto: "Renato começou agora. (ordem o1)" }),
    ...over,
  };
  return { d, chamadas };
}

/** Modelo roteirizado: devolve as respostas na ordem. */
function roteiro(...passos: Awaited<ReturnType<ModeloGerente>>[]): ModeloGerente {
  let i = 0;
  return async () => passos[Math.min(i++, passos.length - 1)];
}
const usa = (id: string, name: string, input: unknown) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input }] });
const fim = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

test("investiga: consulta ao vivo → pergunta à Viva → dispara o Renato → responde; a trilha mostra cada passo", async () => {
  const { d, chamadas } = fakeDeps();
  const r = await investigar(
    "chegou chamado novo?",
    "sys",
    roteiro(
      usa("1", "consultar_banco", { consulta: "chamados_abertos" }),
      usa("2", "perguntar_agente", { slug: "viva", pergunta: "Algum chamado precisa do Daniel?" }),
      usa("3", "executar_agora", { slug: "renato", ordem: "corrigir X" }),
      fim("O que encontrei: VN-000101.\nQuem está cuidando: Viva e você.\nPrazo: 08/10 02:57.\nO que depende de você: responder.\ndados de 07/10 18:40")
    ),
    d
  );
  assert.deepEqual(chamadas, ["consultar:chamados_abertos", "perguntar:viva:Algum chamado precisa do Daniel?", "executar:renato:corrigir X"]);
  assert.deepEqual(
    r.trilha.map((t) => t.texto),
    ["Moacir → Viva: Algum chamado precisa do Daniel?", "Viva: Tenho 1 chamado aberto: VN-000101 (Caução), com o Daniel.", "Disparei Renato: Renato começou agora. (ordem o1)"]
  );
  assert.match(r.resposta, /O que depende de você/);
});

test("parâmetros inválidos não executam nada; disparo que falha não vira 'disparei'", async () => {
  const { d, chamadas } = fakeDeps({ executar: async () => ({ ok: false, texto: "Falta o token da rotina do Renato." }) });
  const r = await investigar(
    "x",
    "sys",
    roteiro(
      usa("1", "consultar_banco", { consulta: "select * from profiles" }),
      usa("2", "perguntar_agente", { slug: "hacker", pergunta: "oi" }),
      usa("3", "executar_agora", { slug: "renato", ordem: "y" }),
      fim("ok")
    ),
    d
  );
  assert.deepEqual(chamadas, []);
  assert.equal(r.trilha[0].texto, "Não consegui disparar Renato: Falta o token da rotina do Renato.");
});

test("prompt do gerente: organograma, formato das 4 linhas, 'dados de', nunca migração", () => {
  const s = systemGerente({ briefing: "Gerente geral.", agora: new Date("2026-10-07T21:40:00Z"), contexto: "Viva Nomads" });
  for (const t of ["atendimento, chamados, clientes → viva", "jurídico e contábil → sergio", "O que encontrei:", "Quem está cuidando:", "Prazo:", "O que depende de você:", "dados de <hora>", "Nunca aplique migração", "não consegui verificar X"]) assert.ok(s.includes(t), t);
  assert.ok(ORGANOGRAMA.some((o) => o.slug === "renato"));
  assert.equal(nomeDoOrganograma("sergio"), "Sérgio");
  assert.ok(ORGANOGRAMA.every((o) => o.nome && o.nome[0] === o.nome[0].toUpperCase()));
});

test("laboratório (sem IA): 'chegou chamado novo?' consulta o banco, pergunta à Viva e responde com o código e o prazo", async () => {
  const { d, chamadas } = fakeDeps();
  const r = await investigar("Chegou chamado novo?", "sys", modeloGerenteSimulado(new Date("2026-10-07T21:40:00Z")), d);
  assert.equal(chamadas[0], "consultar:chamados_abertos");
  assert.match(chamadas[1], /^perguntar:viva:/);
  assert.match(r.resposta, /VN-000101/);
  assert.match(r.resposta, /Prazo: 08\/10 02:57/);
  assert.match(r.resposta, /dados de 07\/10 18:40/);
});

const ag = (slug: string, nome: string): Agente => ({ slug, nome, cargo: "Cargo", esquadrao: "comando", rotina_texto: null, trigger_id: null, status: "ativo", briefing: "Briefing.", ordem: 1 });

test("chat: pergunta ao Moacir usa o gerente e grava a trilha na ordem certa; outros agentes seguem iguais", async () => {
  const gravadas: { autor_slug: string | null; texto: string }[] = [];
  const { d: fer } = fakeDeps();
  const d: Deps = {
    adminId: async () => "a1",
    perguntasHoje: async () => 0,
    agentes: async () => [ag("moacir", "Moacir"), ag("bruno", "Bruno")],
    rondas: async () => [],
    ordensAbertas: async () => [],
    historico: async () => [],
    retrato: async () => null,
    gravar: async (l) => void gravadas.push(...l.map((x) => ({ autor_slug: x.autor_slug, texto: x.texto }))),
    modelo: async () => "resposta comum",
    gerente: { modelo: modeloGerenteSimulado(new Date("2026-10-07T21:40:00Z")), ferramentas: fer },
  };
  const r = await responderChat(d, { slug: "moacir", texto: "chegou chamado novo?" });
  assert.equal(r.status, 200);
  assert.deepEqual(gravadas.map((g) => g.autor_slug), [null, "moacir", "viva", "moacir"]);
  assert.match(gravadas[1].texto, /^Moacir → Viva: /);
  assert.match(String(r.body.resposta), /O que encontrei: VN-000101/);
  const r2 = await responderChat(d, { slug: "bruno", texto: "como está o build?" });
  assert.equal(r2.body.resposta, "resposta comum");
});
