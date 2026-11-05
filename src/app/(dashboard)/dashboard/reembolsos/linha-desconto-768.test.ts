/* Roda: node --test "src/app/(dashboard)/dashboard/reembolsos/linha-desconto-768.test.ts"
  Varredura (passada 15, 768 px): no Reembolso da caução, a linha "Motivo · Valor · Evidência · Adicionar" usava 4 colunas já
  no `sm` (640 px). No tablet o cartão tem ~600 px: os campos não encolhiam (largura mínima própria do <input>), o Valor ficava
  por baixo da Evidência e o "Adicionar" saía da tela (rolagem lateral de 101 px). A 1280 as 4 colunas também ficavam
  apertadas (o exemplo do Motivo cortado, o Valor mais baixo que os vizinhos). Agora: 1 coluna no celular e 2 a partir do
  tablet, campos que encolhem (min-w-0) e campos e botão na mesma altura (h-11).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const ini = s.indexOf('data-testid="reembolso-linha-desconto"');
const linha = s.slice(ini - 160, s.indexOf("Adicionar", ini));

test("a linha de desconto: 1 coluna no celular, 2 a partir do tablet, nunca 4 apertadas", () => {
  assert.ok(ini > 0);
  assert.match(linha, /grid gap-2 sm:grid-cols-2"/);
  assert.doesNotMatch(linha, /grid-cols-\[/);
});

test("campos encolhem e têm a altura do botão; o Valor ocupa a célula inteira", () => {
  const campos = linha.match(/className="[^"]*rounded-lg border border-sage-200[^"]*"/g) ?? [];
  assert.equal(campos.length, 3);
  for (const c of campos) {
    assert.match(c, /\bmin-w-0\b/, c);
    assert.match(c, /\bh-11\b/, c);
  }
  assert.match(linha, /ariaLabel="Valor \(R\$\)"\s+className="w-full /);
  assert.match(linha, /<Button variant="outline" className="h-11"/);
});
