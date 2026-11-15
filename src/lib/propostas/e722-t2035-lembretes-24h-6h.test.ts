/*
  t2035 · E722 (Pista 3, lote 2, item E3) @E722 @ao-vivo-seguro
  Regra: lembretes 24 h e 6 h antes do fim, um de cada, para o morador e para o dono; nunca depois do fim.
  Roda o pre-aceitacao-servidor.ts REAL (dublês só nas bordas, ver e722-harness/) com o relógio do cron de hora em hora
  (vercel.json "0 * * * *"), para 96 inícios de janela (de 30 em 30 min ao longo de 2 dias).
  A parte "nenhum entre 22h e 7h" ficou VERMELHA na main sem quebrar nada: é defeito, registrado no PR para o Gerente,
  e NÃO entra aqui (não se ajusta teste para passar).
  Roda: node --test src/lib/propostas/e722-t2035-lembretes-24h-6h.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { cenario, novoBanco, novoMundo } from "./e722-harness/banco.ts";

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

test("E3: em toda janela de 72 h saem exatamente o de 24 h e o de 6 h, para o morador e para o dono, antes do fim", async () => {
  for (let m = 0; m < 48 * 60; m += 30) {
    const inicio = new Date(Date.parse("2026-11-09T00:00:00Z") + m * 60_000);
    const { prazo, avisos } = await rodarJanela(inicio);
    const rotulo = `início ${inicio.toISOString()}`;
    for (const quem of ["morador-prop-1", "dono-1"]) {
      const meus = avisos.filter((a) => a.userId === quem);
      assert.equal(meus.filter((a) => /faltam 24 horas/.test(a.corpo)).length, 1, `${rotulo}: 24 h para ${quem}`);
      assert.equal(meus.filter((a) => /faltam 6 horas/.test(a.corpo)).length, 1, `${rotulo}: 6 h para ${quem}`);
      assert.equal(meus.length, 2, `${rotulo}: nenhum aviso a mais para ${quem}`);
    }
    for (const a of avisos) {
      assert.ok(a.em!.getTime() < prazo.getTime(), `${rotulo}: aviso depois do fim`);
      const horas = /faltam 24 horas/.test(a.corpo) ? 24 : 6;
      assert.ok(a.em!.getTime() >= prazo.getTime() - horas * H - 9 * H, `${rotulo}: o de ${horas} h saiu cedo demais (${a.em!.toISOString()})`);
    }
  }
});

test("E3: o lembrete diz o prazo exato e a regra de corrida ao morador", async () => {
  const { avisos } = await rodarJanela(new Date("2026-11-09T15:30:00Z")); // fim 12/11 12:30 BRT
  const doMorador = avisos.filter((a) => a.userId === "morador-prop-1");
  for (const a of doMorador) {
    assert.match(a.corpo, /o prazo termina em 12\/11\/2026 às 12:30 \(horário de Brasília\)/);
    assert.match(a.corpo, /o primeiro a concluir o contrato fica com o imóvel/);
  }
});
