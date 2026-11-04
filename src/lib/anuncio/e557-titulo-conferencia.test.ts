/** E557 — "Tudo certo para publicar" só quando o "Publicar anúncio" está de fato liberado — `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tituloConferencia, TEXTOS_REVISAO } from "./assistente-telas.ts";

test("publicação liberada: 'Tudo certo para publicar'", () => {
  assert.equal(tituloConferencia(true, null), TEXTOS_REVISAO.listaTudoCerto);
});

test("falta 1 item (ex.: documento ou declarações na própria Revisão): o título diz o que falta, nunca 'tudo certo'", () => {
  assert.equal(tituloConferencia(false, "Falta 1 item antes de publicar"), "Falta 1 item antes de publicar");
  assert.equal(tituloConferencia(false, "Falta: aceite do texto gerado"), "Falta: aceite do texto gerado");
});

test("travado sem motivo calculado: título neutro, nunca 'tudo certo'", () => {
  assert.equal(tituloConferencia(false, null), TEXTOS_REVISAO.lista);
});

test("a Revisão usa a MESMA regra do botão (podePublicar), não só os itens dos Passos 1 a 9", () => {
  const src = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx", import.meta.url), "utf8");
  assert.match(src, /tituloConferencia\(p\.podePublicar, p\.motivoTravado\)/);
  assert.doesNotMatch(src, /const tudoCerto = conf\.itens\.every/, "antes: lista dos Passos 1-9 ok bastava para 'tudo certo'");
});
