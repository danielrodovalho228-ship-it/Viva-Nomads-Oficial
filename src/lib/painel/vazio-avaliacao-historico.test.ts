/*
  Avaliador, "Encerradas, recusas e ausências": a lista vazia diz o que vai aparecer ali, no lugar de "Nada por aqui ainda.".
  Roda: node --test src/lib/painel/vazio-avaliacao-historico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rotuloSemResposta, textoDoHistoricoVazio } from "../vistoria/relogio-do-pedido.ts";
import { RESPOSTA_DO_AVALIADOR } from "../vistoria/rotulos-do-pedido.ts";

const PAGINA = readFileSync(new URL("../../app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx", import.meta.url), "utf8");

test("o histórico vazio explica o que entra nele, com testid", () => {
  assert.doesNotMatch(PAGINA, /Nada por aqui ainda\./);
  assert.match(PAGINA, /data-testid="avaliacoes-historico-vazio"/);
  // E1157: o texto e o rótulo "sem resposta" leem o prazo que o avaliador declarou; saem de relogio-do-pedido.
  assert.match(PAGINA, /data-testid="avaliacoes-historico-vazio">\s*\{textoDoHistoricoVazio\(cred\.prazo_resposta_horas\)\}/);
  assert.match(textoDoHistoricoVazio(null), /^Aqui ficam as avaliações que você concluiu, as que recusou, as que passaram de 24 horas sem resposta e as ausências registradas\. Ainda não há nenhuma\.$/);
  // Os três rótulos do histórico continuam os mesmos que o texto descreve.
  // E1158 (17; ORDEM-DUET-658): "Você recusou" e "Ausência registrada" vêm da fonte das duas vozes (rotulos-do-pedido).
  assert.match(PAGINA, /\{ \.\.\.RESPOSTA_DO_AVALIADOR\.avaliador, expirada: rotuloSemResposta\(cred\.prazo_resposta_horas\) \}/);
  assert.deepEqual(RESPOSTA_DO_AVALIADOR.avaliador, { recusada: "Você recusou", ausencia: "Ausência registrada" });
  assert.equal(rotuloSemResposta(null), "Sem resposta em 24 horas");
});
