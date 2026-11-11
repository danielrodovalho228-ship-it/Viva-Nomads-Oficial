import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tituloConferencia } from "../../src/lib/anuncio/assistente-telas.ts";
import { motivoPublicarTravado } from "../../src/lib/anuncio/passo10-colunas.ts";

// Lab 10/11: t401 esperava "Tudo certo para publicar" no título da lista com o aceite do termo da IA ainda em aberto
// (a própria spec diz "Travado (falta o aceite)"). Desde o E619/E260 o título da lista é o motivo da trava: com a lista
// em dia e sem o aceite, "Falta: aceite do termo da IA". "Tudo certo" só depois do aceite.
test("t401: lista em dia sem o aceite mostra o motivo; com o aceite, 'Tudo certo'", () => {
  const motivo = motivoPublicarTravado({ faltamNaLista: 0, aceitouIa: false });
  assert.equal(tituloConferencia(false, motivo), "Falta: aceite do termo da IA");
  assert.equal(tituloConferencia(true, null), "Tudo certo para publicar");
  const spec = readFileSync("tests/e2e/specs/t401-cadastro-10-revisao.spec.ts", "utf8");
  assert.doesNotMatch(spec, /innerText\.trim\(\)\)\)\.toBe\("Tudo certo para publicar"\)/);
  assert.match(spec, /innerText\.trim\(\)\)\)\.toBe\("Falta: aceite do termo da IA"\)/);
});
