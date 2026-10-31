/*
  Avaliador, "Visitas": a lista vazia diz o que entra nela (avaliação aceita, para agendar, até o laudo ou o encerramento), no lugar de
  "Nenhuma visita marcada.". O teste prende o texto ao filtro da página.
  Roda: node --test src/lib/painel/vazio-avaliacao-visitas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGINA = readFileSync(new URL("../../app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx", import.meta.url), "utf8");

test("a regra que o texto descreve: entram as designadas já respondidas, as agendadas e as realizadas; o laudo tira da lista", () => {
  assert.match(PAGINA, /const paraResponder = lista\.filter\(\(p\) => p\.status === "designado" && resposta\.get\(p\.id\) === null\);/);
  assert.match(PAGINA, /\.filter\(\(p\) => !paraResponder\.includes\(p\) && \["designado", "agendado", "realizada"\]\.includes\(p\.status\)\)/);
  assert.match(PAGINA, /const encerradas = lista\.filter\(\(p\) => \["laudo_emitido", "ausencia", "cancelada"\]\.includes\(p\.status\)\);/);
});

test("a lista vazia de visitas explica o que entra nela, com testid", () => {
  assert.doesNotMatch(PAGINA, /Nenhuma visita marcada\./);
  assert.match(PAGINA, /data-testid="avaliacoes-visitas-vazio"/);
  assert.match(PAGINA, /As avaliações que você aceitar aparecem aqui, para agendar a visita com o proprietário, e saem daqui quando o laudo sai ou a avaliação é encerrada\./);
});
