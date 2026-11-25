/*
  ORDEM-DUET-273 (20/11): a vigia da suíte. O agendador do GitHub atrasa ou perde as corridas agendadas do
  laboratorio.yml (peça 25 / ORDEM-DUET-207). Um cron da Vercel, 15 min depois de cada slot (01:17 / 09:17 / 17:17 CST),
  confere se a corrida do slot arrancou na main; se não arrancou, despacha o workflow com o token GITHUB_WATCHDOG_TOKEN.
  Roda: node --test src/lib/laboratorio/vigia-suite.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ANTECEDENCIA_MIN, CRON_DEPOIS_MIN, MARGEM_MIN, SLOTS_UTC, decidirVigia, rodarVigia, slotDoMomento, type CorridaGithub } from "./vigia-suite.ts";

const corrida = (id: number, criada: string, extra: Partial<CorridaGithub> = {}): CorridaGithub => ({ id, event: "schedule", head_branch: "main", created_at: criada, ...extra });

test("os slots são os do cron do laboratorio.yml", () => {
  const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
  const crons = [...yml.matchAll(/- cron: "(\d+) (\d+) \* \* \*"/g)].map((m) => ({ h: Number(m[2]), m: Number(m[1]) }));
  assert.deepEqual(crons, SLOTS_UTC);
});

test("o cron da Vercel corre a margem depois de cada slot", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
  const c = vercel.crons.filter((x) => x.path === "/api/cron/vigia-suite");
  assert.equal(c.length, 1);
  const minuto = SLOTS_UTC[0].m + CRON_DEPOIS_MIN;
  // Um cron adiantado (até 5 min) ainda decide: a margem da decisão é menor que o atraso do cron.
  assert.ok(MARGEM_MIN <= CRON_DEPOIS_MIN - 5);
  assert.ok(SLOTS_UTC.every((s) => s.m === SLOTS_UTC[0].m));
  assert.equal(c[0].schedule, `${minuto} ${SLOTS_UTC.map((s) => s.h).join(",")} * * *`);
});

test("o slot do momento é o último slot que já passou (também o da véspera)", () => {
  assert.equal(slotDoMomento(new Date("2026-11-20T15:32:00Z")).toISOString(), "2026-11-20T15:17:00.000Z");
  assert.equal(slotDoMomento(new Date("2026-11-20T23:32:00Z")).toISOString(), "2026-11-20T23:17:00.000Z");
  assert.equal(slotDoMomento(new Date("2026-11-21T07:32:00Z")).toISOString(), "2026-11-21T07:17:00.000Z");
  assert.equal(slotDoMomento(new Date("2026-11-21T03:00:00Z")).toISOString(), "2026-11-20T23:17:00.000Z");
});

test("corrida da main desde pouco antes do slot (agendada ou manual): coberto, não despacha", () => {
  const agora = new Date("2026-11-20T15:32:00Z");
  assert.equal(decidirVigia(agora, [corrida(1, "2026-11-20T15:20:00Z")]).acao, "coberto");
  assert.equal(decidirVigia(agora, [corrida(2, "2026-11-20T15:10:00Z", { event: "workflow_dispatch" })]).acao, "coberto");
  assert.equal(ANTECEDENCIA_MIN, 10);
});

test("sem corrida do slot, passada a margem: despacha", () => {
  const agora = new Date("2026-11-20T15:32:00Z");
  const d = decidirVigia(agora, [corrida(1, "2026-11-20T07:18:00Z"), corrida(2, "2026-11-20T15:20:00Z", { head_branch: "outro" })]);
  assert.equal(d.acao, "despachar");
  assert.equal(d.slot.toISOString(), "2026-11-20T15:17:00.000Z");
});

test("antes da margem espera; mais de 2 h depois do slot não despacha (já não conta para o slot)", () => {
  assert.equal(decidirVigia(new Date("2026-11-20T15:25:00Z"), []).acao, "cedo");
  assert.equal(decidirVigia(new Date("2026-11-20T15:28:00Z"), []).acao, "despachar");
  assert.equal(decidirVigia(new Date("2026-11-20T17:30:00Z"), []).acao, "fora");
});

type Pedido = { url: string; metodo: string; corpo?: string; auth: string | null };
function falso(corridas: CorridaGithub[], estadoDespacho = 204) {
  const pedidos: Pedido[] = [];
  const f = async (url: string, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    pedidos.push({ url, metodo: init?.method ?? "GET", corpo: init?.body as string | undefined, auth: h.get("authorization") });
    if ((init?.method ?? "GET") === "GET") return new Response(JSON.stringify({ total_count: corridas.length, workflow_runs: corridas }), { status: 200 });
    return new Response(null, { status: estadoDespacho });
  };
  return { pedidos, f: f as typeof fetch };
}

test("rodarVigia lê as corridas com o token e despacha o laboratorio.yml na main quando falta a do slot", async () => {
  const { pedidos, f } = falso([]);
  const r = await rodarVigia({ token: "tok", agora: new Date("2026-11-20T15:32:00Z"), fetch: f });
  assert.equal(r.acao, "despachar");
  assert.equal(r.despachada, true);
  assert.equal(pedidos.length, 2);
  assert.match(pedidos[0].url, /^https:\/\/api\.github\.com\/repos\/danielrodovalho228-ship-it\/Viva-Nomads-Oficial\/actions\/workflows\/laboratorio\.yml\/runs\?branch=main&per_page=30&created=%3E%3D2026-11-20T15%3A07%3A00Z$/);
  assert.equal(pedidos[0].auth, "Bearer tok");
  assert.equal(pedidos[1].metodo, "POST");
  assert.match(pedidos[1].url, /\/actions\/workflows\/laboratorio\.yml\/dispatches$/);
  assert.deepEqual(JSON.parse(pedidos[1].corpo ?? "{}"), { ref: "main" });
});

test("rodarVigia: coberto não despacha; verificar só lê; despacho recusado fica registado", async () => {
  const coberto = falso([corrida(9, "2026-11-20T15:20:00Z")]);
  const r1 = await rodarVigia({ token: "t", agora: new Date("2026-11-20T15:32:00Z"), fetch: coberto.f });
  assert.equal(r1.acao, "coberto");
  assert.equal(r1.corrida, 9);
  assert.equal(coberto.pedidos.length, 1);

  const so = falso([]);
  const r2 = await rodarVigia({ token: "t", agora: new Date("2026-11-20T15:32:00Z"), fetch: so.f, verificar: true });
  assert.equal(r2.acao, "despachar");
  assert.equal(r2.despachada, false);
  assert.equal(so.pedidos.length, 1);

  const recusa = falso([], 403);
  const r3 = await rodarVigia({ token: "t", agora: new Date("2026-11-20T15:32:00Z"), fetch: recusa.f });
  assert.equal(r3.despachada, false);
  assert.equal(r3.estadoDespacho, 403);
});

test("a rota: CRON_SECRET, o token só do ambiente e nunca no log nem na resposta", () => {
  const rota = readFileSync("src/app/api/cron/vigia-suite/route.ts", "utf8");
  assert.match(rota, /request\.headers\.get\("authorization"\) !== `Bearer \$\{segredo\}`/);
    // O valor do token vive só na variável `chave`, que só vai para o rodarVigia.
  assert.match(rota, /const chave = process\.env\.GITHUB_WATCHDOG_TOKEN/);
  assert.equal((rota.match(/\bchave\b/g) ?? []).length, 3);
  assert.match(rota, /rodarVigia\(\{ token: chave, agora: new Date\(\), verificar \}\)/);
});
