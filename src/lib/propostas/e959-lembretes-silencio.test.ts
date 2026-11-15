/*
  E959 — lembretes do pré-aceite (24 h e 6 h) nunca saem no silêncio das 22h às 7h (Brasília). PURO, determinístico.
   T2. Simulação do cron em tiques de 60 min: inícios a cada 15 min ao longo de 4 dias (384), cada um com o prazo de 72 h
       e com prazos encurtados pela entrada (10 h, 30 h e 50 h). Confere: nenhum envio entre 22h00 e 06h59; nenhum depois
       do prazo; todo lembrete (instante nominal depois do início) que tem ao menos um tique permitido entre o início e o
       prazo é enviado exatamente uma vez; e nenhum sai sem tique permitido.
   T3. Casos nomeados do prompt do E959.
  Roda: node --test src/lib/propostas/e959-lembretes-silencio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CADENCIA_CRON_PRE_ACEITACAO_MIN, LEMBRETES_HORAS, deveEnviarLembrete, inicioDaJanela, lembretesDaPreAceitacao, momentoDoLembrete, tiqueEmOuDepois,
} from "./pre-aceitacao.ts";
import { emSilencio } from "../notifications/silencio.ts";

const H = 3_600_000;
const PASSO = CADENCIA_CRON_PRE_ACEITACAO_MIN * 60_000;
const t = (s: string) => new Date(s);
/** "AAAA-MM-DD HH:MM" em Brasília → instante. */
const brt = (s: string) => new Date(`${s.replace(" ", "T")}:00-03:00`);

/** O cron de verdade, puro: em cada tique do início ao prazo, manda o que `deveEnviarLembrete` deixa, uma vez cada. */
function simular(inicio: Date, prazo: Date) {
  const lembretes = lembretesDaPreAceitacao(inicio, prazo);
  const enviados = new Map<number, Date>();
  for (let x = tiqueEmOuDepois(inicio).getTime(); x < prazo.getTime() + 2 * PASSO; x += PASSO) {
    const agora = new Date(x);
    for (const l of lembretes) if (!enviados.has(l.horasAntes) && deveEnviarLembrete(l.enviarEm, prazo, agora)) enviados.set(l.horasAntes, agora);
  }
  return { lembretes, enviados };
}

/** Há ao menos um tique permitido (fora do silêncio) com início < tique < prazo? */
function temTiquePermitido(inicio: Date, prazo: Date) {
  for (let x = tiqueEmOuDepois(new Date(inicio.getTime() + 1)).getTime(); x < prazo.getTime(); x += PASSO) if (!emSilencio(new Date(x))) return true;
  return false;
}

test("E959 cadência: a constante única bate com a agenda do cron em vercel.json", () => {
  const vercel = JSON.parse(readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
  const job = vercel.crons.find((c) => c.path === "/api/cron/pre-aceitacao");
  assert.ok(job, "o cron dos lembretes está no vercel.json");
  assert.equal(CADENCIA_CRON_PRE_ACEITACAO_MIN, 60);
  assert.equal(job!.schedule, "0 * * * *", "de hora em hora, no minuto 0 — se mudar, muda a constante junto");
});

test("E959 T2: simulação do cron — zero no silêncio, zero depois do prazo, cada lembrete com tique permitido sai uma vez", () => {
  let casos = 0;
  let enviadosTotal = 0;
  const falhas: string[] = [];
  for (let q = 0; q < 384; q++) {
    const inicio = new Date(Date.parse("2026-11-09T03:00:00Z") + q * 15 * 60_000);
    for (const horas of [72, 50, 30, 10]) {
      const prazo = new Date(inicio.getTime() + horas * H);
      casos++;
      const { lembretes, enviados } = simular(inicio, prazo);
      const rot = `início ${inicio.toISOString()} prazo ${horas} h`;
      for (const [h, em] of enviados) {
        enviadosTotal++;
        if (emSilencio(em)) falhas.push(`${rot}: o de ${h} h saiu no silêncio (${em.toISOString()})`);
        if (em.getTime() >= prazo.getTime()) falhas.push(`${rot}: o de ${h} h saiu depois do prazo`);
        if (em.getTime() <= inicio.getTime()) falhas.push(`${rot}: o de ${h} h saiu antes do início`);
      }
      for (const l of lembretes) if (!enviados.has(l.horasAntes)) falhas.push(`${rot}: o de ${l.horasAntes} h foi planejado e não saiu`);
      for (const h of LEMBRETES_HORAS) {
        const nominal = prazo.getTime() - h * H;
        if (nominal <= inicio.getTime()) {
          if (enviados.has(h)) falhas.push(`${rot}: o de ${h} h saiu com janela curta demais`);
          continue;
        }
        const pode = temTiquePermitido(inicio, prazo);
        if (pode && !enviados.has(h)) falhas.push(`${rot}: o de ${h} h tinha tique permitido e não saiu`);
        if (!pode && enviados.has(h)) falhas.push(`${rot}: o de ${h} h saiu sem tique permitido`);
      }
    }
  }
  assert.equal(casos, 1536);
  assert.ok(enviadosTotal > 2000, `a simulação mandou lembretes (${enviadosTotal})`);
  assert.deepEqual(falhas.slice(0, 10), [], `${falhas.length} falhas`);
});

/** Quando o cron manda o lembrete de instante `nominal` (null = não sai). */
function saiEm(nominal: Date, inicio: Date, prazo: Date): Date | null {
  const q = momentoDoLembrete(nominal, inicio, prazo);
  if (!q) return null;
  for (let x = tiqueEmOuDepois(q).getTime(); x < prazo.getTime(); x += PASSO) if (deveEnviarLembrete(q, prazo, new Date(x))) return new Date(x);
  return null;
}

test("E959 T3a: nominal às 21h30, prazo às 10h do dia seguinte → sai às 7h", () => {
  assert.equal(saiEm(brt("2026-11-10 21:30"), brt("2026-11-08 10:00"), brt("2026-11-11 10:00"))?.getTime(), brt("2026-11-11 07:00").getTime());
});

test("E959 T3b: nominal às 21h30, prazo às 6h → sai às 21h00", () => {
  assert.equal(saiEm(brt("2026-11-10 21:30"), brt("2026-11-08 06:00"), brt("2026-11-11 06:00"))?.getTime(), brt("2026-11-10 21:00").getTime());
});

test("E959 T3c: nominal às 23h, prazo às 8h → sai às 7h", () => {
  assert.equal(saiEm(brt("2026-11-10 23:00"), brt("2026-11-08 08:00"), brt("2026-11-11 08:00"))?.getTime(), brt("2026-11-11 07:00").getTime());
});

test("E959 T3d: nominal às 23h, prazo às 6h30 → 21h00 do dia anterior se esse tique está depois do início; senão não sai", () => {
  const prazo = brt("2026-11-11 06:30");
  assert.equal(saiEm(brt("2026-11-10 23:00"), brt("2026-11-10 20:30"), prazo)?.getTime(), brt("2026-11-10 21:00").getTime());
  assert.equal(saiEm(brt("2026-11-10 23:00"), brt("2026-11-10 21:30"), prazo), null);
});

test("E959 T3e: janela encurtada pela entrada — o de 6 h só sai se cair depois do início REAL (o aceite)", () => {
  const aceite = brt("2026-11-10 14:00");
  // Entrada 11/11 00:00 → prazo 10 h depois do aceite. O de 6 h (18:00) cai depois do aceite: sai às 18:00.
  const prazo = brt("2026-11-11 00:00");
  const inicio = inicioDaJanela(prazo, aceite);
  assert.equal(inicio.getTime(), aceite.getTime(), "o início é o aceite, não prazo − 72 h");
  assert.deepEqual(lembretesDaPreAceitacao(inicio, prazo).map((l) => l.horasAntes), [6]);
  assert.equal(saiEm(brt("2026-11-10 18:00"), inicio, prazo)?.getTime(), brt("2026-11-10 18:00").getTime());
  // Aceite às 19:00 com o mesmo prazo: o de 6 h (18:00) cairia antes do aceite → não sai (com prazo − 72 h, saía).
  const tarde = inicioDaJanela(prazo, brt("2026-11-10 19:00"));
  assert.deepEqual(lembretesDaPreAceitacao(tarde, prazo), []);
  assert.ok(lembretesDaPreAceitacao(new Date(prazo.getTime() - 72 * H), prazo).some((l) => l.horasAntes === 6), "com prazo − 72 h o de 6 h entraria");
  // Janela cheia (aceite antigo): vale prazo − 72 h.
  assert.equal(inicioDaJanela(t("2026-11-14T15:00:00Z"), t("2026-11-01T00:00:00Z")).getTime(), t("2026-11-11T15:00:00Z").getTime());
});

test("E959: envio fora do silêncio, só depois do planejado e antes do fim", () => {
  const prazo = brt("2026-11-12 10:00");
  const plan = brt("2026-11-11 21:30");
  assert.equal(deveEnviarLembrete(plan, prazo, brt("2026-11-11 21:00")), false, "antes do planejado");
  assert.equal(deveEnviarLembrete(plan, prazo, brt("2026-11-11 22:00")), false, "22h00 é silêncio");
  assert.equal(deveEnviarLembrete(plan, prazo, brt("2026-11-12 06:00")), false, "06h00 é silêncio");
  assert.equal(deveEnviarLembrete(plan, prazo, brt("2026-11-12 07:00")), true);
  assert.equal(deveEnviarLembrete(plan, prazo, brt("2026-11-12 10:00")), false, "no fim ou depois, não");
});

test("E959 (varredura): lembrete D-1 da vistoria não sai no silêncio — o tique das 00h07 espera o das 7h07 do mesmo dia", async () => {
  const { lembreteD1Devido } = await import("../vistoria/regras.ts");
  const visita = "2026-11-12T13:00:00Z"; // 12/11 10:00 BRT; hoje (Brasília) = 11/11
  assert.equal(lembreteD1Devido(visita, "2026-11-11", brt("2026-11-11 00:07")), false, "00h07 é silêncio");
  assert.equal(lembreteD1Devido(visita, "2026-11-11", brt("2026-11-11 07:07")), true);
  assert.equal(lembreteD1Devido(visita, "2026-11-11", brt("2026-11-11 21:07")), true);
  assert.equal(lembreteD1Devido(visita, "2026-11-11", brt("2026-11-11 22:07")), false, "22h07 é silêncio");
  assert.equal(lembreteD1Devido(visita, "2026-11-10", brt("2026-11-10 12:00")), false, "a visita não é amanhã");
});
