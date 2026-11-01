/*
  Agenda do dono, dia aberto sem nada: diz o que a Agenda mostra e, com o filtro de um imóvel, que o vazio é só dele
  (antes: "Nada marcado neste dia.", mesmo com outro imóvel ocupado no dia).
  Roda: node --test src/lib/agenda-dia-vazio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_TIPO_AGENDA, textoDiaSemAgenda } from "./agenda.ts";

const TELA = readFileSync(new URL("../app/(dashboard)/dashboard/agenda/agenda-client.tsx", import.meta.url), "utf8");

test("sem filtro: os 4 tipos da Agenda", () => {
  assert.equal(textoDiaSemAgenda(), "Nenhuma visita, entrada, saída ou data bloqueada neste dia.");
  assert.equal(textoDiaSemAgenda(""), "Nenhuma visita, entrada, saída ou data bloqueada neste dia.");
  // Os tipos que o texto cita são os da Agenda.
  assert.deepEqual(Object.keys(ROTULO_TIPO_AGENDA).sort(), ["bloqueio", "entrada", "saida", "visita"]);
});

test("com filtro: o vazio é do imóvel filtrado e diz como ver os outros", () => {
  assert.equal(
    textoDiaSemAgenda("Apto Santa Mônica"),
    'Nenhuma visita, entrada, saída ou data bloqueada neste dia em Apto Santa Mônica. Escolha "Todos os imóveis" para ver os outros.',
  );
  assert.match(TELA, /<option value="">Todos os imóveis<\/option>/);
});

test("a tela usa o texto com o imóvel do filtro, com testid, e não o genérico", () => {
  assert.doesNotMatch(TELA, /Nada marcado neste dia\./);
  assert.match(TELA, /data-testid="agenda-dia-vazio">\{textoDiaSemAgenda\(imoveis\.find\(\(p\) => p\.id === imovel\)\?\.titulo\)\}/);
});
