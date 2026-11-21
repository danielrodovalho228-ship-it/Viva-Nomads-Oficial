/*
  E959 T1 — a trava nomeada do defeito da Pista 3 (#3848, "DEFEITO E3"): com o cron de hora em hora (vercel.json
  "0 * * * *"), NENHUM lembrete do pré-aceite sai entre 22h e 7h (Brasília). Roda o pre-aceitacao-servidor.ts REAL pelo
  harness do #3848 (e722-harness/, copiado sem mudança): 96 inícios de janela (de 30 em 30 min ao longo de 2 dias),
  2 lembretes × 2 pessoas = 384 lembretes. Na main: 36 de 384 no silêncio (o tique das 22h00).
  A asserção é a do #3848; não muda.
  Roda: node --test src/lib/propostas/e959-t1-silencio-cron.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { cenario, novoBanco, novoMundo } from "./e722-harness/banco.ts";
import { emSilencio } from "../notifications/silencio.ts";

const { rodarPreAceitacao } = await import("./pre-aceitacao-servidor.ts");
const H = 3_600_000;

async function rodarJanela(inicio: Date) {
  const prazo = new Date(inicio.getTime() + 72 * H);
  const mundo = novoMundo();
  const db = novoBanco(cenario({ prazo, aceitaEm: inicio }));
  for (let t = Math.ceil(inicio.getTime() / H) * H; t < prazo.getTime(); t += H) {
    mundo.agora = new Date(t);
    await rodarPreAceitacao(db.admin, mundo.agora);
  }
  return { prazo, avisos: mundo.avisos };
}

test("DEFEITO E3: nenhum lembrete sai entre 22h e 7h (cron de hora em hora)", async () => {
  const noSilencio: string[] = [];
  let total = 0;
  for (let m = 0; m < 48 * 60; m += 30) {
    const inicio = new Date(Date.parse("2026-11-09T00:00:00Z") + m * 60_000);
    const { prazo, avisos } = await rodarJanela(inicio);
    total += avisos.length;
    for (const a of avisos) if (emSilencio(a.em!)) noSilencio.push(`fim ${prazo.toISOString()} → enviado ${a.em!.toISOString()} (${/faltam 24 horas/.test(a.corpo) ? "faltam 24 horas" : "faltam 6 horas"})`);
  }
  assert.equal(total, 384, "os 384 lembretes da simulação");
  assert.deepEqual(noSilencio, [], `${noSilencio.length} de ${total} lembretes no silêncio; ex.: ${noSilencio.slice(0, 2).join(" | ")}`);
});
