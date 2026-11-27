/**
 * Matriz, passada 5 (T838 no laboratório, 04/11): /admin/avaliadores tinha DOIS botões cheios ("Abrir verificação" e
 * "Salvar valor"). Regra da casa: um botão cheio por tela. Fica cheio "Abrir verificação"; "Salvar valor" (tabela de
 * preço) passa ao contorno, como os demais envios da tela. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync(new URL("../../app/(dashboard)/admin/avaliadores/page.tsx", import.meta.url), "utf8");

test("/admin/avaliadores: um botão cheio só (Abrir verificação)", () => {
  const botoes = [...pagina.matchAll(/<Button\b([^>]*)>([^<]+)<\/Button>/g)];
  const cheios = botoes.filter(([, attrs]) => !/variant="(secondary|outline|ghost|link)"/.test(attrs)).map(([, , rotulo]) => rotulo.trim());
  assert.deepEqual(cheios, ["Abrir verificação"]);
  assert.match(pagina, /<Button type="submit" variant="secondary" size="sm">Salvar valor<\/Button>/);
});
