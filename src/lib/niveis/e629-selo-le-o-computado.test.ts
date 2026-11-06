/*
  E629 (rodada 10): o cartão "[TESTE QA NÍVEL] Premium" mostrava o selo Essencial. O selo lê o nível COMPUTADO — o motor está certo e o
  que estava errado era o NOME da massa. Aqui o motor roda com as entradas REAIS desse anúncio (lidas em produção, só leitura, em
  06/11/2026) e devolve Essencial pelo elo mais fraco; a 0305 renomeia o título para dizer a verdade.
  Roda: node --test src/lib/niveis/e629-selo-le-o-computado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VERSAO_CONFORTO, CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { itensFotoDoAlvo } from "./e625-semente.ts";
import { nivelDoImovel, type EntradaNivel, type ItemDeclarado } from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-11-06T00:30:00Z");

/** O anúncio 330ebf37: os 18 itens de foto do Premium, todos declarados, foto antiga ('arquivo', refazer até 23/11) e pendente de análise; ruído baixo; UMA medição, do quarto principal, inválida. */
function entradaReal(): EntradaNivel {
  const itens = itensFotoDoAlvo("premium")
    .map((chave): ItemDeclarado => ({ chave, declarado: true, fotoPath: "x/y.webp", fotoStatus: "pendente", fotoOrigem: "arquivo", refazerAte: "2026-11-23T16:47:26Z" }));
  return {
    declaracoesConforto: CHAVES_CONFORTO.map((chave) => ({ chave, confirmado: true, versao_lista: VERSAO_CONFORTO })),
    itens,
    medidas: [{ ponto: "quarto_principal", downloadMbps: 17.4, uploadMbps: 13.6, latenciaMs: 132, validada: false, medidoEm: "2026-10-23T00:00:00Z", validoAte: "2027-04-23T00:00:00Z" }],
    ruido: { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false },
    bloqueadas: [],
    agora: AGORA,
  };
}

test("E629: com as entradas reais do anúncio, o motor devolve Essencial pelo elo mais fraco (internet e trabalho)", () => {
  const r = nivelDoImovel(entradaReal());
  assert.equal(r.nivel, "essencial");
  assert.equal(r.porArea.internet, "essencial"); // sem medição válida
  assert.equal(r.porArea.trabalho, "conforto"); // falta a videochamada no ponto de trabalho
  for (const a of ["sono", "banho", "clima", "cozinha", "sala", "lavanderia", "ruido"] as const) assert.equal(r.porArea[a], "premium", a);
});

test("E629: com a medição do quarto e do trabalho válidas, o MESMO anúncio chega a Premium (o motor não graduou errado)", () => {
  const e = entradaReal();
  const ok = (ponto: "quarto_principal" | "trabalho") => ({ ponto, downloadMbps: 110, uploadMbps: 55, latenciaMs: 20, validada: true, medidoEm: "2026-11-05T00:00:00Z", validoAte: "2027-05-05T00:00:00Z" });
  assert.equal(nivelDoImovel({ ...e, medidas: [ok("quarto_principal"), ok("trabalho")] }).nivel, "premium");
});

test("E629: a 0305 só renomeia o título (idempotente, sem tocar nível, provas ou medições) e tem rollback", () => {
  const mig = ler("supabase/migrations/0305_qa_titulo_nivel_premium_e629.sql");
  assert.match(mig, /and title = '\[TESTE QA NÍVEL\] Premium';/);
  assert.match(mig, /set title = '\[TESTE QA NÍVEL\] Essencial \(falta medir a internet para chegar a Premium\)'/);
  assert.doesNotMatch(mig.replace(/--.*$/gm, ""), /imovel_nivel|nivel_itens|internet_medicoes/);
  assert.ok(ler("supabase/producao/aplicar-0305.sql").includes(mig.trim()));
  assert.match(ler("supabase/producao/rollback/0305_rollback.sql"), /version = '20261105000305'/);
});
