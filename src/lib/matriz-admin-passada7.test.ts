/** Onda 5, passada 7 (04/11): as linhas admin-* da matriz foram conferidas em conteúdo — nenhuma fica "A conferir". `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const matriz = readFileSync(new URL("../../docs/matriz-conformidade-mockups.md", import.meta.url), "utf8");
const linhas = matriz.split("\n").filter((l) => /^\| `admin-/.test(l));

test("as 13 linhas do admin estão na matriz", () => {
  assert.equal(linhas.length, 13);
});

test("nenhuma linha do admin fica 'A conferir'; cada uma traz a prova da passada 7", () => {
  for (const l of linhas) {
    const [, tela, , estado, obs] = l.split("|");
    assert.notEqual(estado.trim(), "A conferir", tela);
    assert.match(obs, /Passada 7 \(04\/11/, tela);
  }
});

test("moderar aponta para a moderação dos pedidos de moradia (/admin/pedidos)", () => {
  const moderar = linhas.find((l) => l.startsWith("| `admin-moderar`"))!;
  assert.match(moderar.split("|")[2], /\/admin\/pedidos/);
});
