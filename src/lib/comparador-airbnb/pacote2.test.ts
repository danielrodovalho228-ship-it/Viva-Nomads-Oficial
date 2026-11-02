/*
  E399-C, pacote 2 (liberado pelo Daniel em 01/11) — o motor de comparação, com dados SIMULADOS, atrás da chave.
   - selo só se o Total por mês da Viva (com contas) for ESTRITAMENTE MENOR que o total de 30 noites do mesmo anúncio
     no Airbnb (noite a noite, com desconto de estadia longa + limpeza + taxa do hóspede); igual NÃO ganha;
   - comparação = simulação das próximas 30 noites DISPONÍVEIS, nunca diária × 30;
   - preço maior/igual → aviso só ao dono (painel + e-mail) com o valor lá e "até R$ Y";
   - reconsulta semanal; selo suspenso com dado de mais de 14 dias.
  Roda: node --test src/lib/comparador-airbnb/pacote2.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decidirSelo, precisaReconsultar, recomendacaoAte, total30Noites, DIAS_DADO_VALIDO, DIAS_RECONSULTA, type CalendarioAirbnb } from "./comparacao.ts";
import { fonteSimulada } from "./fonte.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const dia = (n: number) => new Date(Date.UTC(2026, 10, 2 + n)).toISOString().slice(0, 10);

function calendario(precos: (number | null)[], extra: Partial<CalendarioAirbnb> = {}): CalendarioAirbnb {
  return {
    noites: precos.map((p, i) => ({ data: dia(i), preco: p ?? 0, disponivel: p != null })),
    descontoSemanalPct: 0,
    descontoMensalPct: 0,
    limpeza: 0,
    taxaHospedePct: 0,
    ...extra,
  };
}

test("30 noites: soma noite a noite das próximas 30 DISPONÍVEIS (pula as ocupadas), nunca diária × 30", () => {
  // 31 noites, a 3ª ocupada: entram as noites 1, 2 e 4–31, com preços diferentes (fim de semana mais caro).
  const precos: (number | null)[] = Array.from({ length: 31 }, (_, i) => (i === 2 ? null : i % 7 >= 5 ? 200 : 100));
  const r = total30Noites(calendario(precos));
  const esperado = precos.filter((p): p is number => p != null).slice(0, 30).reduce((s, p) => s + p, 0);
  assert.equal(r?.noites, 30);
  assert.equal(r?.total, esperado);
  assert.notEqual(r?.total, precos[0]! * 30);
  // Menos de 30 noites livres no horizonte: sem dado (nunca completa com a diária).
  assert.equal(total30Noites(calendario(Array.from({ length: 29 }, () => 100))), null);
});

test("30 noites: desconto de estadia longa (mensal, senão semanal) + limpeza + taxa do hóspede", () => {
  const c = calendario(Array.from({ length: 30 }, () => 100), { descontoMensalPct: 20, descontoSemanalPct: 10, limpeza: 150, taxaHospedePct: 14 });
  // 3000 − 20% = 2400; + 150 = 2550; taxa do hóspede 14% sobre 2550 = 357 → 2907.
  assert.deepEqual(total30Noites(c), { noites: 30, total: 2907, primeiraNoite: dia(0) });
  const semMensal = calendario(Array.from({ length: 30 }, () => 100), { descontoSemanalPct: 10 });
  assert.equal(total30Noites(semMensal)?.total, 2700);
});

test("selo: ESTRITAMENTE menor ganha; igual ou maior não ganha e avisa o dono com 'até R$ Y'", () => {
  const agora = new Date("2026-11-10T12:00:00Z");
  const consultadoEm = "2026-11-08T12:00:00Z";
  assert.deepEqual(decidirSelo({ totalViva: 2906, total30: 2907, consultadoEm, conferencia: "confere" }, agora), { selo: true, estado: "justo", avisoDono: null });
  const igual = decidirSelo({ totalViva: 2907, total30: 2907, consultadoEm, conferencia: "confere" }, agora);
  assert.equal(igual.selo, false);
  assert.equal(igual.estado, "acima");
  assert.deepEqual(igual.avisoDono, { valorAirbnb: 2907, ate: 2906 });
  const acima = decidirSelo({ totalViva: 3500, total30: 2907.4, consultadoEm, conferencia: "confere" }, agora);
  assert.deepEqual(acima.avisoDono, { valorAirbnb: 2907.4, ate: 2907 });
  assert.equal(recomendacaoAte(2907), 2906);
  assert.equal(recomendacaoAte(2907.4), 2907);
});

test("selo: sem link conferido, sem dado ou com dado de mais de 14 dias → sem selo (suspenso)", () => {
  const agora = new Date("2026-11-30T12:00:00Z");
  assert.equal(DIAS_DADO_VALIDO, 14);
  const base = { totalViva: 2000, total30: 2907, conferencia: "confere" as const };
  assert.equal(decidirSelo({ ...base, consultadoEm: "2026-11-16T12:00:00Z" }, agora).selo, true); // 14 dias exatos
  assert.deepEqual(decidirSelo({ ...base, consultadoEm: "2026-11-15T11:00:00Z" }, agora), { selo: false, estado: "suspenso", avisoDono: null });
  assert.deepEqual(decidirSelo({ ...base, consultadoEm: null }, agora), { selo: false, estado: "sem_dado", avisoDono: null });
  assert.deepEqual(decidirSelo({ ...base, total30: null, consultadoEm: "2026-11-29T12:00:00Z" }, agora), { selo: false, estado: "sem_dado", avisoDono: null });
  assert.deepEqual(decidirSelo({ ...base, conferencia: "diverge", consultadoEm: "2026-11-29T12:00:00Z" }, agora), { selo: false, estado: "bloqueado", avisoDono: null });
  assert.deepEqual(decidirSelo(null, agora), { selo: false, estado: "sem_link", avisoDono: null });
  assert.deepEqual(decidirSelo({ ...base, totalViva: 0, consultadoEm: "2026-11-29T12:00:00Z" }, agora), { selo: false, estado: "sem_dado", avisoDono: null });
});

test("reconsulta semanal: 7 dias depois da última consulta (ou nunca consultado)", () => {
  assert.equal(DIAS_RECONSULTA, 7);
  const agora = new Date("2026-11-10T12:00:00Z");
  assert.equal(precisaReconsultar(null, agora), true);
  assert.equal(precisaReconsultar("2026-11-04T12:00:00Z", agora), false);
  assert.equal(precisaReconsultar("2026-11-03T12:00:00Z", agora), true);
});

test("fonte simulada: calendário estável por anúncio, com noites ocupadas e preços que variam; sem rede", async () => {
  const a = await fonteSimulada.calendario("12345678", new Date("2026-11-02T00:00:00Z"));
  assert.deepEqual(a, await fonteSimulada.calendario("12345678", new Date("2026-11-02T00:00:00Z")));
  assert.ok(a.noites.length >= 45);
  assert.ok(a.noites.some((n) => !n.disponivel));
  assert.ok(new Set(a.noites.map((n) => n.preco)).size > 1);
  const t = total30Noites(a)!;
  assert.equal(t.noites, 30);
  // Finais de QA: 2 → anúncio barato (a Viva fica acima); 3 → caro (a Viva ganha o selo).
  const barato = total30Noites(await fonteSimulada.calendario("12345672", new Date("2026-11-02T00:00:00Z")))!;
  const caro = total30Noites(await fonteSimulada.calendario("12345673", new Date("2026-11-02T00:00:00Z")))!;
  assert.ok(barato.total < 1500 && caro.total > 15000, `${barato.total} ${caro.total}`);
});

test("servidor e telas: chave, reconsulta no cron, aviso ao dono (painel + e-mail) e selo público pelo motor", () => {
  const srv = ler("src/lib/comparador-airbnb/comparacao-servidor.ts");
  assert.match(srv, /if \(!PRECO_JUSTO_COMPARADOR\) return/);
  assert.match(srv, /precisaReconsultar\(/);
  assert.match(srv, /event: "preco_justo_acima"/);
  assert.match(ler("src/app/api/cron/calendario/route.ts"), /rotinaPrecoJusto\(admin, agora\)/);
  const mig = ler("supabase/migrations/0280_preco_justo_comparacao.sql");
  for (const c of ["total_30_noites", "consultado_em", "aviso_enviado_em", "aviso_valor"]) assert.match(mig, new RegExp(`add column if not exists ${c}`));
  assert.match(ler("supabase/producao/aplicar-0280.sql"), /'20261101000280', '0280_preco_justo_comparacao'/);
  const dados = ler("src/lib/data/properties.ts");
  assert.match(dados, /if \(PRECO_JUSTO_COMPARADOR\) \{/);
  assert.match(dados, /decidirSelo\(/);
  assert.match(ler("src/components/precos/campo-link-airbnb.tsx"), /data-testid="preco-justo-aviso-dono"/);
  assert.match(ler("src/config/matriz-notificacoes.ts"), /preco_justo_acima: \{/);
});
