import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E478: o operador do /admin tem o sino de avisos (o do E444) em todas as páginas, no computador e no celular.
const shell = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");
const faixa = shell.match(/data-testid="topo-celular">([\s\S]*?)<\/main>|data-testid="topo-celular">([\s\S]{0,900})/);

test("E478: a faixa do topo do /admin traz o sino com o prefixo admin", () => {
  assert.ok(faixa, "faixa do topo existe");
  assert.match(faixa[0], /naAreaAdmin && <Sino px="admin" \/>/);
});

test("E478: o sino do admin vem antes do menu da Conta e do hambúrguer", () => {
  const i = shell.indexOf('<Sino px="admin" />');
  assert.ok(i > 0);
  assert.ok(i < shell.indexOf("{contaCelular ?? papelChip}", i - 400) + 1000);
  assert.ok(i < shell.indexOf('aria-label="Abrir menu"'));
});

test("E478: o sino das áreas de papel continua só no topo do papel (sem duplicar)", () => {
  assert.equal((shell.match(/<Sino /g) ?? []).length, 2);
});
