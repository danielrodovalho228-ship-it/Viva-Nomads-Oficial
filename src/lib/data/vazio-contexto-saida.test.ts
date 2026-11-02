/*
  Estados vazios — /admin/qualidade, contexto de uma saída ("Sair da Viva"): falha ao ler não vira "Nada encontrado
  para esta pessoa". contextoDaSaida lança em qualquer erro de leitura; a tela mostra o aviso de falha.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("contextoDaSaida lança em cada leitura que falha (saída, chamados, contratos, pedidos)", () => {
  const src = ler("./qualidade.ts");
  const i = src.indexOf("export async function contextoDaSaida(");
  const f = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(f, /if \(eSaida\) throw new Error\(MSG_CONTEXTO_SEM_LEITURA\);/);
  assert.match(f, /if \(comoMorador\.error \|\| comoDono\.error \|\| pedidos\.error\) throw new Error\(MSG_CONTEXTO_SEM_LEITURA\);/);
  assert.equal((f.match(/if \(error\) throw new Error\(MSG_CONTEXTO_SEM_LEITURA\);/g) ?? []).length, 2);
  assert.doesNotMatch(f, /const \{ data \} = await/);
});

test("a tela distingue falha de vazio", () => {
  const tela = ler("../../app/(dashboard)/admin/qualidade/page.tsx");
  assert.ok(tela.includes('contextoDaSaida(saidaAberta).catch(() => "falhou" as const)'));
  assert.match(tela, /data-testid="saida-contexto-falhou"/);
  assert.ok(tela.includes('ctx && ctx !== "falhou" &&'));
});
