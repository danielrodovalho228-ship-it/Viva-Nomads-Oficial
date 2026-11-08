/*
  E687 — Mudança/frete: a empresa e o veículo pedidos no cadastro chegam ao parceiro APROVADO (coluna parceiros.dados_categoria,
  copiada do pedido na ativação) e aparecem no painel dele. Roda: node --test src/lib/parceiros/e687-dados-da-categoria.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhasDadosDaCategoria } from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E687: Mudança mostra Empresa e Veículo; outras categorias, nada", () => {
  assert.deepEqual(linhasDadosDaCategoria(["mudanca"], { empresa: "Carretos Silva", veiculo: "Baú 3/4" }), [
    { rotulo: "Empresa de mudança", valor: "Carretos Silva" },
    { rotulo: "Veículo", valor: "Baú 3/4" },
  ]);
  assert.deepEqual(linhasDadosDaCategoria(["limpeza"], { empresa: "X", veiculo: "Y" }), []);
  assert.deepEqual(linhasDadosDaCategoria(["mudanca"], null), []);
  assert.deepEqual(linhasDadosDaCategoria(["mudanca", "outro"], { empresa: " ", veiculo: "Van" }), [{ rotulo: "Veículo", valor: "Van" }]);
});

test("E687: a ativação copia dados_categoria do pedido para o parceiro; o painel lê e mostra", () => {
  const nucleo = ler("src/lib/parceiros/ativacao-nucleo.ts");
  assert.match(nucleo, /dados_categoria: sol\.dados_categoria \?\? \{\}/);
  assert.match(ler("src/lib/parceiros/ativacao-actions.ts"), /const COLUNAS_PEDIDO = "[^"]*dados_categoria[^"]*"/);
  assert.match(ler("src/lib/parceiros/painel-actions.ts"), /dadosCategoria: \(p\.dados_categoria/);
  assert.match(ler("src/app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx"), /linhasDadosDaCategoria\(p\.categorias, p\.dadosCategoria\)/);
});

test("E687: a 0326 cria a coluna, preenche de quem já foi ativado e o aplicar embrulha o mesmo corpo", () => {
  const mig = ler("supabase/migrations/0326_parceiro_dados_categoria_e687.sql");
  assert.match(mig, /add column if not exists dados_categoria jsonb not null default '\{\}'::jsonb/);
  assert.match(mig, /update public\.parceiros/);
  const ap = ler("supabase/producao/aplicar-0326.sql");
  assert.match(ap, /'20261107000326', '0326_parceiro_dados_categoria_e687'/);
  assert.match(ler("supabase/producao/rollback/0326_rollback.sql"), /version = '20261107000326'/);
});
