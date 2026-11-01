/*
  Auditoria de erros e estados vazios — achado nº 11: Buscas salvas, Orçamentos e Garantias mostravam o estado vazio
  quando a leitura do banco falhava (a pessoa salvaria a busca de novo; o dono não via a proposta; a caução sumia). Agora
  as três telas pedem com `exigir`: a falha lança e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo".
  Roda: node --test src/lib/data/lista-buscas-orcamentos-garantias-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("buscas salvas: com exigir, a falha das duas leituras lança", () => {
  const src = ler("src/lib/data/buscas-salvas-actions.ts");
  assert.match(src, /export async function listarBuscasSalvas\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(src, /if \(semAlerta\?\.error && opcoes\.exigir\) throw new Error\(MSG_BUSCAS_NAO_CARREGARAM\);/);
});

test("as três telas pedem com exigir; a home pede dentro de ou(...) e avisa (achado nº 24)", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/buscas/page.tsx"), /await listarBuscasSalvas\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/orcamentos/page.tsx"), /listarPropostas\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/garantias/page.tsx"), /getMeusContratos\(\{ exigir: true \}\), getContratosDoInquilino\(\)\]\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/page.tsx"), /ou\("buscas", listarBuscasSalvas\(\{ exigir: true \}\), null\)/);
  // Achado nº 24: a home pede com exigir, mas SEMPRE dentro de ou(...) — a falha vira aviso no topo, nunca a página de erro.
  const homeA24 = ler("src/app/(dashboard)/dashboard/page.tsx");
  assert.equal((homeA24.match(/exigir: true/g) ?? []).length, (homeA24.match(/ou\("[a-z]+", [A-Za-z]+\([^)]*\{ exigir: true \}\)/g) ?? []).length);
});
