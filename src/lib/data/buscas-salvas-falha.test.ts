/*
  Estados vazios (coração "Salvar busca"): alternarBuscaSalva ignorava o erro de duas leituras.
   1. "Já está salva?" falhava → tratava como não salva → o clique SALVAVA DE NOVO (uma 2ª cópia) em vez de remover;
   2. a contagem falhava → contava 0 → o limite de buscas salvas era pulado.
  Agora as duas leituras conferem o erro e, na falha, o coração pede para tentar de novo (nada é gravado nem apagado).
  buscaEstaSalva também lança na falha (o coração mantém o estado que já tinha — o .catch da tela).
  Roda: node --test src/lib/data/buscas-salvas-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/lib/data/buscas-salvas-actions.ts", "utf8");
const alternar = s.slice(s.indexOf("export async function alternarBuscaSalva"), s.indexOf("const MSG_BUSCAS_NAO_CARREGARAM"));
const esta = s.slice(s.indexOf("export async function buscaEstaSalva"), s.indexOf("export async function alternarBuscaSalva"));

test("alternar: a falha ao conferir se já está salva não grava uma 2ª cópia", () => {
  // E539 (ii): a conferência é pela identidade (mesmasBuscas: null = falha de leitura).
  assert.match(alternar, /const iguais = await mesmasBuscas\(s, qs\);/);
  assert.match(alternar, /if \(!iguais\) return \{ ok: false, error: MSG_CONFERIR_BUSCA \};/);
  assert.ok(alternar.indexOf("if (!iguais)") < alternar.indexOf(".insert("), "confere antes de inserir");
});

test("alternar: a falha na contagem não pula o limite", () => {
  assert.match(alternar, /const \{ count, error: erroContagem \} = await s\.supabase/);
  assert.match(alternar, /if \(erroContagem\) return \{ ok: false, error: MSG_CONFERIR_BUSCA \};/);
  assert.ok(alternar.indexOf("if (erroContagem)") < alternar.indexOf(".insert("), "confere antes de inserir");
});

test("estado do coração: a falha lança (não vira 'não salva')", () => {
  // E539 (ii): pela identidade (mesmasBuscas: null = falha de leitura).
  assert.match(esta, /const iguais = await mesmasBuscas\(s, qs\);/);
  assert.match(esta, /if \(!iguais\) throw new Error\(MSG_CONFERIR_BUSCA\);/);
  assert.match(s, /const MSG_CONFERIR_BUSCA = "Não foi possível conferir esta busca agora\. Tente de novo\.";/);
});
