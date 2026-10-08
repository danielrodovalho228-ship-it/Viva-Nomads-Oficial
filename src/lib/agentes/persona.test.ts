import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ehConversaSocial, extrairLembrar, fatoSeguro, blocoPersonaMemoria, type Memoria } from "./persona.ts";
import { apagarMemoria, listarMemorias, responderChat, type Deps, type DepsMemoria } from "./motor.ts";
import { systemChat, type Agente } from "./central.ts";
import { systemGerente } from "./gerente.ts";

const ag = (slug: string, nome: string): Agente => ({ slug, nome, cargo: "Cargo", esquadrao: "comando", rotina_texto: null, trigger_id: null, status: "ativo", briefing: "Briefing.", ordem: 1 });
const mem = (fato: string, i = 0): Memoria => ({ id: `m${i}`, agente_slug: "moacir", fato, criado_em: "2026-10-08T12:00:00Z" });

function montar(over: Partial<Deps> = {}) {
  const gravadas: { papel: string; texto: string }[] = [];
  const systems: string[] = [];
  const lembradas: string[][] = [];
  let investigou = 0;
  let pediuMemorias: number | null = null;
  let retratoLido = 0;
  const d: Deps = {
    adminId: async () => "a1",
    perguntasHoje: async () => 0,
    agentes: async () => [ag("moacir", "Moacir"), ag("bruno", "Bruno")],
    rondas: async () => [],
    ordensAbertas: async () => [],
    historico: async () => [],
    retrato: async () => {
      retratoLido++;
      return null;
    },
    gravar: async (l) => void gravadas.push(...l.map((x) => ({ papel: x.papel, texto: x.texto }))),
    modelo: async (p) => {
      systems.push(p.system);
      return "Oi, Daniel! Tudo bem por aqui. E você?";
    },
    persona: async () => "Calmo, bem-humorado, fala como um colega mineiro.",
    memorias: async (_s, n) => {
      pediuMemorias = n;
      return [mem("Daniel prefere respostas curtas")];
    },
    lembrar: async (_s, fatos) => void lembradas.push(fatos),
    gerente: {
      modelo: async () => {
        investigou++;
        return { stop_reason: "end_turn", content: [{ type: "text", text: "O que encontrei: nada.\nQuem está cuidando: equipe.\nPrazo: —.\nO que depende de você: nada para você agora.\ndados de 08/10 10:00" }] };
      },
      ferramentas: { consultar: async () => "", perguntarAgente: async () => ({ nome: "Viva", resposta: "" }), executar: async () => ({ ok: true, texto: "" }), nomeDe: (s: string) => s },
    },
    ...over,
  };
  return { d, gravadas, systems, lembradas, investigou: () => investigou, pediuMemorias: () => pediuMemorias, retratoLido: () => retratoLido };
}

test("conversa social: cumprimento é social; pergunta do projeto não", () => {
  for (const t of ["oi", "Oi!", "Bom dia", "bom dia, tudo bem?", "tudo bem?", "obrigado!", "valeu", "e aí"]) assert.equal(ehConversaSocial(t), true, t);
  for (const t of ["oi, chegou chamado novo?", "chegou chamado novo?", "como estamos?", "bom dia, qual o status da ronda?", "tem algum P0?", "", "x".repeat(200)]) assert.equal(ehConversaSocial(t), false, t);
});

test("Moacir: cumprimento NÃO chama investigar() nem gera relatório; usa a persona e a memória", async () => {
  const t = montar();
  const r = await responderChat(t.d, { slug: "moacir", texto: "Bom dia!" });
  assert.equal(r.status, 200);
  assert.equal(t.investigou(), 0);
  assert.equal(t.retratoLido(), 0);
  assert.doesNotMatch(String(r.body.resposta), /O que encontrei:/);
  assert.match(t.systems[0], /Calmo, bem-humorado/);
  assert.match(t.systems[0], /Daniel prefere respostas curtas/);
  assert.match(t.systems[0], /Cumprimento recebe cumprimento/);
  assert.match(t.systems[0], /agente de IA com personagem/);
  assert.deepEqual(t.gravadas.map((g) => g.papel), ["daniel", "agente"]);
});

test("Moacir: pergunta sobre o projeto continua investigando (formato de relatório)", async () => {
  const t = montar();
  const r = await responderChat(t.d, { slug: "moacir", texto: "chegou chamado novo?" });
  assert.equal(t.investigou(), 1);
  assert.match(String(r.body.resposta), /O que encontrei:/);
});

test("memória: pede as últimas 30; 'lembrar:' é gravado e some do texto mostrado", async () => {
  const t = montar({ modelo: async () => 'Anotado, Daniel!\nlembrar: ["Daniel gosta de café sem açúcar"]' });
  const r = await responderChat(t.d, { slug: "bruno", texto: "Eu tomo café sem açúcar, tá?" });
  assert.equal(t.pediuMemorias(), 30);
  assert.deepEqual(t.lembradas, [["Daniel gosta de café sem açúcar"]]);
  assert.equal(r.body.resposta, "Anotado, Daniel!");
  assert.doesNotMatch(t.gravadas.map((g) => g.texto).join("\n"), /lembrar:/);
});

test("memória do Moacir (caminho do gerente) também grava e limpa a linha 'lembrar:'", async () => {
  const t = montar();
  t.d.gerente!.modelo = async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: 'O que encontrei: nada.\nQuem está cuidando: equipe.\nPrazo: —.\nO que depende de você: nada para você agora.\nlembrar: ["Daniel trabalha melhor de manhã"]' }] });
  const r = await responderChat(t.d, { slug: "moacir", texto: "como estamos?" });
  assert.deepEqual(t.lembradas, [["Daniel trabalha melhor de manhã"]]);
  assert.doesNotMatch(String(r.body.resposta), /lembrar:/);
});

test("memória NEGATIVO: saúde, finanças, documentos, contatos e terceiros nunca são guardados", () => {
  const ruins = ["Daniel tem diabetes", "Daniel ganha 20 mil por mês", "CPF 123.456.789-09 do Daniel", "e-mail daniel@x.com", "ligar para (34) 99999-1234", "A esposa do Daniel viaja muito", "O cliente João deve dinheiro", "x".repeat(501), "", "Daniel guarda a senha no papel"];
  for (const f of ruins) assert.equal(fatoSeguro(f), false, f);
  const { texto, fatos } = extrairLembrar(`Certo!\nlembrar: ["Daniel tem diabetes", "Daniel prefere reunião curta", "daniel prefere reunião curta", 7, "CPF 123.456.789-09"]`);
  assert.equal(texto, "Certo!");
  assert.deepEqual(fatos, ["Daniel prefere reunião curta"]);
});

test("memória: JSON inválido não guarda nada; no máximo 3 fatos por mensagem", () => {
  assert.deepEqual(extrairLembrar("ok\nlembrar: [quebrado").fatos, []);
  assert.deepEqual(extrairLembrar("ok\nlembrar: [não é json]").fatos, []);
  const { fatos } = extrairLembrar('ok\nlembrar: ["a1","a2","a3","a4","a5"]');
  assert.equal(fatos.length, 3);
});

test("persona/memória fora do ar (migração ainda não aplicada): a conversa segue normal", async () => {
  const t = montar({ persona: async () => Promise.reject(new Error("coluna não existe")), memorias: async () => Promise.reject(new Error("tabela não existe")), lembrar: async () => Promise.reject(new Error("x")) });
  const r = await responderChat(t.d, { slug: "bruno", texto: "oi" });
  assert.equal(r.status, 200);
  assert.doesNotMatch(t.systems[0], /Sua persona/);
});

test("laboratório (sem IA): cumprimento recebe cumprimento, sem relatório", async () => {
  const t = montar({ chatSimulado: true, aoVivo: async () => ({ dados: "x", conferencia: { migracoes: null, chamadosAbertos: null } as never }) });
  const r = await responderChat(t.d, { slug: "bruno", texto: "oi" });
  assert.match(String(r.body.resposta), /^Oi! Aqui é o Bruno/);
});

test("prompts: systemChat e systemGerente incluem persona, as memórias e as regras de conversa", () => {
  const a = { ...ag("moacir", "Moacir"), persona: "Mineiro calmo." };
  const ms = Array.from({ length: 3 }, (_, i) => mem(`fato ${i}`, i));
  for (const s of [systemChat(a, [], [], "", ms), systemGerente({ briefing: "G.", agora: new Date(), contexto: "Viva", persona: a.persona, memorias: ms })]) {
    for (const t of ["Mineiro calmo.", "- fato 0", "- fato 2", "não invente fatos sobre o Daniel".replace("não", "Não"), "NUNCA guarde saúde, finanças, documentos"]) assert.ok(s.includes(t), t);
  }
  assert.equal(blocoPersonaMemoria(null, []).includes("Sua persona"), false);
  const muitas = Array.from({ length: 50 }, (_, i) => mem(`f${i}`, i));
  assert.equal(blocoPersonaMemoria("p", muitas).split("\n").filter((l) => /^- f\d+$/.test(l)).length, 30);
});

function depsMem(admin: string | null, apagou = true) {
  const chamadas: string[] = [];
  const d: DepsMemoria = {
    adminId: async () => admin,
    listar: async (s) => (chamadas.push(`listar:${s}`), [mem("fato")]),
    apagar: async (id) => (chamadas.push(`apagar:${id}`), apagou),
  };
  return { d, chamadas };
}

test("memória (listar/apagar): não-admin recebe 403 e não toca no banco", async () => {
  const { d, chamadas } = depsMem(null);
  assert.equal((await listarMemorias(d, "moacir")).status, 403);
  assert.equal((await apagarMemoria(d, { id: "3f2b8a52-6c1d-4b8e-9f1a-2d7c4e5a6b7c" })).status, 403);
  assert.deepEqual(chamadas, []);
});

test("memória (listar/apagar): entrada inválida é 400; admin lista e apaga", async () => {
  const { d, chamadas } = depsMem("a1");
  assert.equal((await listarMemorias(d, "../x")).status, 400);
  assert.equal((await listarMemorias(d, null)).status, 400);
  assert.equal((await apagarMemoria(d, { id: "1 or 1=1" })).status, 400);
  assert.equal((await apagarMemoria(d, null)).status, 400);
  assert.deepEqual(chamadas, []);
  assert.equal((await listarMemorias(d, "moacir")).status, 200);
  assert.equal((await apagarMemoria(d, { id: "3f2b8a52-6c1d-4b8e-9f1a-2d7c4e5a6b7c" })).status, 200);
  assert.equal((await apagarMemoria(depsMem("a1", false).d, { id: "3f2b8a52-6c1d-4b8e-9f1a-2d7c4e5a6b7c" })).status, 404);
});

test("migração 0092: só admin (RLS), anon/authenticated sem acesso solto, limite de 500, idempotente e registrada", () => {
  const mig = readFileSync("supabase/migrations/0092_agentes_persona_memoria.sql", "utf8");
  const prod = readFileSync("supabase/producao/aplicar-0092.sql", "utf8");
  for (const sql of [mig, prod]) {
    assert.match(sql, /add column if not exists persona text/);
    assert.match(sql, /create table if not exists public\.agentes_memoria/);
    assert.match(sql, /char_length\(fato\) between 1 and 500/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on public\.agentes_memoria from anon, authenticated/);
    assert.match(sql, /using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/);
    assert.doesNotMatch(sql, /to anon|to public/i);
    assert.match(sql, /drop policy if exists agentes_memoria_admin_all/);
  }
  assert.match(prod, /^begin;/m);
  assert.match(prod, /^commit;/m);
  assert.match(prod, /insert into supabase_migrations\.schema_migrations/);
  assert.match(prod, /'0092_[a-z0-9_]+'/);
});
