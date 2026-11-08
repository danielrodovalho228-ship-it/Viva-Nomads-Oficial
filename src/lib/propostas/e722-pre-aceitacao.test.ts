import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEMBRETES_HORAS, MAX_REABERTURAS, PRAZO_PRE_ACEITACAO_HORAS, TEXTO_PERDEU_A_VEZ, TEXTO_PERDEU_A_VEZ_DONO, TEXTO_REGRA_CORRIDA, TEXTO_TAXA_CONTINUA,
  estadoDaPreAceitacao, lembretesDaPreAceitacao, podeReabrir, prazoDaPreAceitacao, reabrirPreAceitacao, textoDoPrazo,
} from "./pre-aceitacao.ts";
import { emSilencio } from "../notifications/silencio.ts";

const H = 3_600_000;
const t = (s: string) => new Date(s);

test("72 horas corridas a partir da pré-aceitação, com a data e a hora exatas no texto", () => {
  assert.equal(PRAZO_PRE_ACEITACAO_HORAS, 72);
  const inicio = t("2026-11-08T15:30:00Z"); // 12:30 em Brasília
  const prazo = prazoDaPreAceitacao(inicio, "2026-12-20");
  assert.equal(prazo.getTime() - inicio.getTime(), 72 * H);
  assert.equal(textoDoPrazo(prazo), "11/11/2026 às 12:30 (horário de Brasília)");
});

test("o prazo é limitado pela data de entrada quando ela vem antes das 72 h", () => {
  const inicio = t("2026-11-08T15:30:00Z");
  const prazo = prazoDaPreAceitacao(inicio, "2026-11-10"); // entrada 10/11 00:00 BRT < 11/11 12:30
  assert.equal(textoDoPrazo(prazo), "10/11/2026 às 00:00 (horário de Brasília)");
  assert.ok(prazo.getTime() - inicio.getTime() < 72 * H);
  // Entrada depois das 72 h: vale a janela cheia; sem entrada informada também.
  assert.equal(prazoDaPreAceitacao(inicio, "2026-11-30").getTime() - inicio.getTime(), 72 * H);
  assert.equal(prazoDaPreAceitacao(inicio, null).getTime() - inicio.getTime(), 72 * H);
});

test("lembretes 24 h e 6 h antes do fim, nunca no silêncio de 22h às 7h e nunca depois do fim", () => {
  assert.deepEqual([...LEMBRETES_HORAS], [24, 6]);
  // Fim às 12:30 BRT: 24 h antes = 12:30 e 6 h antes = 06:30 (silêncio -> 07:00 do mesmo dia).
  const inicio = t("2026-11-08T15:30:00Z");
  const prazo = prazoDaPreAceitacao(inicio, null);
  const l = lembretesDaPreAceitacao(inicio, prazo);
  assert.equal(l.length, 2);
  assert.equal(l[0].horasAntes, 24);
  assert.equal(l[0].enviarEm.getTime(), prazo.getTime() - 24 * H);
  assert.equal(l[1].horasAntes, 6);
  assert.equal(l[1].enviarEm.getTime(), t("2026-11-11T10:00:00Z").getTime()); // 07:00 BRT
  for (const x of l) {
    assert.equal(emSilencio(x.enviarEm), false);
    assert.ok(x.enviarEm.getTime() < prazo.getTime());
  }
});

test("lembrete cujo 'depois do silêncio' passaria do fim sai antes do silêncio (21h59 do dia anterior)", () => {
  // Fim às 06:00 BRT (09:00Z): o de 6 h cairia às 00:00 (silêncio) e as 07:00 já passam do fim.
  const prazo = t("2026-11-11T09:00:00Z");
  const inicio = new Date(prazo.getTime() - 72 * H);
  const l = lembretesDaPreAceitacao(inicio, prazo).find((x) => x.horasAntes === 6)!;
  assert.equal(emSilencio(l.enviarEm), false);
  assert.equal(l.enviarEm.getTime(), t("2026-11-11T00:59:00Z").getTime()); // 21:59 BRT do dia 10
});

test("janela curta demais não ganha o lembrete que cairia antes do início", () => {
  const inicio = t("2026-11-08T15:00:00Z");
  const prazo = new Date(inicio.getTime() + 10 * H);
  const l = lembretesDaPreAceitacao(inicio, prazo);
  assert.deepEqual(l.map((x) => x.horasAntes), [6]);
});

test("vigente com horas restantes; expirada ao passar do fim", () => {
  const prazo = t("2026-11-11T15:30:00Z");
  assert.deepEqual(estadoDaPreAceitacao(prazo, t("2026-11-11T09:30:00Z")), { chave: "vigente", horasRestantes: 6 });
  assert.deepEqual(estadoDaPreAceitacao(prazo, prazo), { chave: "expirada" });
});

test("no máximo 2 reaberturas; a taxa congelada continua a mesma, sem recalcular", () => {
  assert.equal(MAX_REABERTURAS, 2);
  assert.equal(podeReabrir(0), true);
  assert.equal(podeReabrir(1), true);
  assert.equal(podeReabrir(2), false);
  const agora = t("2026-11-12T15:00:00Z");
  const a = reabrirPreAceitacao({ reaberturas: 0, taxaCongelada: 0.08, dataEntrada: "2026-12-20", agora })!;
  assert.equal(a.reaberturas, 1);
  assert.equal(a.taxaCongelada, 0.08);
  assert.equal(a.prazo.getTime() - agora.getTime(), 72 * H);
  const b = reabrirPreAceitacao({ reaberturas: 1, taxaCongelada: a.taxaCongelada, dataEntrada: "2026-12-20", agora })!;
  assert.equal(b.reaberturas, 2);
  assert.equal(b.taxaCongelada, 0.08);
  assert.equal(reabrirPreAceitacao({ reaberturas: 2, taxaCongelada: 0.08, dataEntrada: "2026-12-20", agora }), null);
  // Entrada já passou: não reabre.
  assert.equal(reabrirPreAceitacao({ reaberturas: 0, taxaCongelada: 0.08, dataEntrada: "2026-11-10", agora }), null);
});

test("os textos escritos trazem a regra de corrida, a ausência de punição e a taxa que continua valendo", () => {
  assert.match(TEXTO_REGRA_CORRIDA, /vários pré-aceites para as mesmas datas, o primeiro a concluir o contrato fica com o imóvel/);
  assert.match(TEXTO_REGRA_CORRIDA, /Os demais recebem uma mensagem clara e voltam à fila do proprietário/);
  assert.match(TEXTO_PERDEU_A_VEZ, /Outra pessoa concluiu o contrato deste imóvel, nas mesmas datas, antes de você/);
  assert.match(TEXTO_PERDEU_A_VEZ, /voltou para a fila do proprietário/);
  assert.match(TEXTO_PERDEU_A_VEZ_DONO, /voltou para a sua fila/);
  assert.match(TEXTO_TAXA_CONTINUA, /taxa congelada na pré-aceitação CONTINUA VALENDO, não recalcula/);
});
