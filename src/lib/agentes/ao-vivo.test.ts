/*
  Todos os agentes com dados AO VIVO no chat (não só o Moacir).
  Roda: node --test src/lib/agentes/ao-vivo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AREA_AO_VIVO, conferirPendencias, consultasDaArea, MARCA_RESOLVIDO, marcarResolvidos, numeroMigracao, respostaSimuladaAgente, type Conferencia } from "./ao-vivo.ts";
import { CONSULTAS } from "./gerente.ts";
import { responderChat, type Deps } from "./motor.ts";
import type { Agente, Ronda } from "./central.ts";

const agora = new Date("2026-10-07T21:00:00Z");
const CONF: Conferencia = {
  migracoes: [
    { version: "20261007000083", name: "0083_pacote_otavio" },
    { version: "20261007000086", name: "0086_agente_luana_seo" },
    { version: "20261007000085", name: "" },
  ],
  resolvidos: [{ numero: "VN-000101", quando: "2026-10-07T20:10:00Z", nota: 5 }],
  abertos: ["VN-000150"],
};

const RONDA_OTAVIO: Ronda = {
  id: "r1",
  agente_slug: "otavio",
  iniciada_em: "2026-10-07T16:58:00Z",
  concluida_em: null,
  status: "alerta",
  resumo: "Fila conferida.",
  link_sessao: null,
  achados: [
    { prioridade: "P1", titulo: "Precisa de você: OK da 0083" },
    { prioridade: "P1", titulo: "VN-000101 aguardando resposta" },
    { prioridade: "P2", titulo: "Precisa de você: OK da 0084" },
    { prioridade: "P2", titulo: "VN-000150 sem resposta" },
  ],
};

test("cada área tem consultas prontas válidas; quem não está no mapa fica com as contagens", () => {
  for (const [slug, cs] of Object.entries(AREA_AO_VIVO)) for (const c of cs) assert.ok((CONSULTAS as readonly string[]).includes(c), `${slug}: ${c}`);
  assert.deepEqual(consultasDaArea("otavio"), ["rondas_recentes", "migracoes", "chamados_abertos", "chamados_resolvidos", "ultimo_deploy"]);
  assert.ok(consultasDaArea("viva").includes("chamados_abertos"));
  assert.ok(consultasDaArea("bruno").includes("rondas_recentes"));
  assert.ok(consultasDaArea("carla").includes("contagens"));
  assert.deepEqual(consultasDaArea("desconhecido"), ["contagens"]);
});

test("número da migração pelo nome ou pela versão", () => {
  assert.equal(numeroMigracao({ version: "20261007000083", name: "0083_pacote_otavio" }), "0083");
  assert.equal(numeroMigracao({ version: "20261007000085", name: "" }), "0085");
  assert.equal(numeroMigracao({ version: "x", name: "sem_numero" }), null);
});

test("conferência: 0083 aplicada e VN-000101 resolvido saem; 0084 (não registrada) e VN-000150 (aberto) ficam", () => {
  const texto = RONDA_OTAVIO.achados.map((a) => a.titulo).join("\n");
  const rs = conferirPendencias(texto, CONF);
  assert.deepEqual(rs.map((r) => r.ref).sort(), ["0083", "VN-000101"]);
  assert.match(rs.find((r) => r.ref === "VN-000101")!.motivo, /resolvido 07\/10 17:10 \(nota 5\)/);
  // Chamado resolvido que foi REABERTO não conta como resolvido.
  assert.deepEqual(conferirPendencias("VN-000101", { ...CONF, abertos: ["VN-000101"] }), []);
});

test("rondas chegam ao modelo com as pendências resolvidas marcadas", () => {
  const [r] = marcarResolvidos([RONDA_OTAVIO], CONF);
  const titulos = r.achados.map((a) => a.titulo ?? "");
  assert.ok(titulos[0].includes(MARCA_RESOLVIDO) && titulos[0].includes("já aplicada"));
  assert.ok(titulos[1].includes(MARCA_RESOLVIDO));
  assert.ok(!titulos[2].includes(MARCA_RESOLVIDO));
  assert.ok(!titulos[3].includes(MARCA_RESOLVIDO));
  assert.equal(RONDA_OTAVIO.achados[0].titulo, "Precisa de você: OK da 0083", "não altera o original");
});

test("laboratório: o Otávio separa resolvido de pendente, com a hora da ronda e 'dados de'", () => {
  const t = respostaSimuladaAgente({ nome: "Otávio", ultima: RONDA_OTAVIO, conferencia: CONF, agora });
  assert.match(t, /^Da minha ronda de 07\/10 13:58, conferido no banco agora:/);
  const [resolvido, pendente] = [t.split("\n")[1], t.split("\n")[2]];
  assert.ok(resolvido.includes("0083") && resolvido.includes("VN-000101"), resolvido);
  assert.ok(!pendente.includes("0083") && !pendente.includes("VN-000101"), pendente);
  assert.ok(pendente.includes("0084") && pendente.includes("VN-000150"), pendente);
  assert.match(t, /dados de 07\/10 18:00 \(laboratório, sem IA\)$/);
});

const ag = (slug: string, nome: string): Agente => ({ slug, nome, cargo: "Cargo", esquadrao: "comando", rotina_texto: null, trigger_id: "t", status: "ativo", briefing: "B.", ordem: 1 });
function fake(over: Partial<Deps> = {}) {
  const chamadas: { system: string }[] = [];
  const d: Deps = {
    adminId: async () => "admin-1",
    perguntasHoje: async () => 0,
    agentes: async () => [ag("otavio", "Otávio"), ag("moacir", "Moacir")],
    rondas: async () => [RONDA_OTAVIO],
    ordensAbertas: async () => [],
    historico: async () => [],
    retrato: async () => null,
    gravar: async () => {},
    modelo: async (p) => (chamadas.push(p), "ok"),
    aoVivo: async () => ({ dados: "Migrações aplicadas em produção (dados de 18:00)…", conferencia: CONF }),
    ...over,
  };
  return { d, chamadas };
}

test("chat de QUALQUER agente leva os dados ao vivo, a lista JÁ RESOLVIDO e a regra", async () => {
  const { d, chamadas } = fake();
  const r = await responderChat(d, { slug: "otavio", texto: "alguma pendência?" });
  assert.equal(r.status, 200);
  const s = chamadas[0].system;
  assert.ok(s.includes("DADOS AO VIVO DA SUA ÁREA (dados de "), s.slice(-600));
  assert.ok(s.includes("JÁ RESOLVIDO DESDE A ÚLTIMA RONDA"));
  assert.ok(s.includes("migração 0083: já aplicada em produção"));
  assert.ok(s.includes("VN-000101: resolvido 07/10 17:10"));
  assert.ok(!s.includes("migração 0084: já aplicada"));
  assert.ok(s.includes('diga "resolvido desde a última ronda"'));
  assert.ok(s.includes("da minha ronda de <hora>"));
  assert.ok(s.includes(MARCA_RESOLVIDO), "a ronda no prompt vem marcada");
});

test("sem dados ao vivo: avisa que a informação é da última ronda; laboratório responde sem modelo", async () => {
  const sem = fake({ aoVivo: async () => null });
  await responderChat(sem.d, { slug: "otavio", texto: "alguma pendência?" });
  assert.match(sem.chamadas[0].system, /Não consegui ler os dados ao vivo agora: avise que a informação é da sua última ronda/);
  const lab = fake({ chatSimulado: true });
  const r = await responderChat(lab.d, { slug: "otavio", texto: "alguma pendência?" });
  assert.equal(lab.chamadas.length, 0);
  assert.match(String(r.body.resposta), /Resolvido desde a última ronda: .*0083.*VN-000101/);
});

test("migração 0088: só versão e nome, só service_role; sem DROP, sem NOTICE", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0088_migracoes_aplicadas.sql", import.meta.url), "utf8").replace(/--.*$/gm, "");
  assert.doesNotMatch(sql, /\bdrop\b|\bif not exists\b/i);
  assert.match(sql, /returns table \(version text, name text\)/);
  assert.doesNotMatch(sql, /statements/);
  assert.match(sql, /revoke all on function public\.migracoes_aplicadas\(\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.migracoes_aplicadas\(\) to service_role/);
});
