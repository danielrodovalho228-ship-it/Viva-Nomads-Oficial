import test from "node:test";
import assert from "node:assert/strict";
import { ROTULO_QUEM_RESPONDEU, linhaQuemRespondeuHtml } from "./quem-respondeu.ts";

test("ordem 7436a29a item 1: rótulos dizem se foi a assistente virtual ou uma pessoa", () => {
  assert.equal(ROTULO_QUEM_RESPONDEU.viva, "Viva (assistente virtual)");
  assert.equal(ROTULO_QUEM_RESPONDEU.equipe, "Equipe Viva Nomads (pessoa)");
});

test("ordem 7436a29a item 1: o e-mail traz a linha 'Respondido por' com o rótulo certo", () => {
  assert.match(linhaQuemRespondeuHtml("viva"), /Respondido por:.*Viva \(assistente virtual\)/);
  assert.match(linhaQuemRespondeuHtml("equipe"), /Respondido por:.*Equipe Viva Nomads \(pessoa\)/);
  assert.doesNotMatch(linhaQuemRespondeuHtml("viva"), /pessoa\)/);
});

test("ordem 7436a29a item 1: os três envios de 'chamado_respondido' informam quem respondeu", async () => {
  const { readFileSync } = await import("node:fs");
  const viva = readFileSync("src/lib/atendimento/viva-servidor.ts", "utf8");
  const acoes = readFileSync("src/lib/data/atendimento-actions.ts", "utf8");
  assert.equal((viva.match(/linhaQuemRespondeuHtml\("viva"\)/g) ?? []).length, 2);
  assert.match(acoes, /linhaQuemRespondeuHtml\("equipe"\)/);
  const ajuda = readFileSync("src/components/ajuda/central-ajuda.tsx", "utf8");
  assert.match(ajuda, /admin: ROTULO_QUEM_RESPONDEU\.equipe/);
});
