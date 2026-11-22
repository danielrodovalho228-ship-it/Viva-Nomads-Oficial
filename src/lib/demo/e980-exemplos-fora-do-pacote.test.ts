/*
  E980 — os dados FICTÍCIOS do modo demonstração (src/lib/demo/seed.ts: nomes, imóveis e valores de exemplo) iam no
  JavaScript de todas as telas do painel, para toda conta, porque oito telas importavam o seed de forma estática. O
  t193 (o piso da proposta, R$ 2.900, nunca chega ao navegador do morador) falha na main desde 13/11: as 6 ocorrências
  de "2900" estavam num pacote estático com `valorMensal:2900` e `monthlyPrice:2900` do seed.
  Regra: nenhuma tela importa o seed de forma estática. Ele é carregado sob demanda (useExemplos), só com o modo
  demonstração ligado — que é só do admin e só existe com NEXT_PUBLIC_MODO_DEMO_PAINEL=1.
  Roda: node --test src/lib/demo/e980-exemplos-fora-do-pacote.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../../", import.meta.url).pathname;
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
const TODOS = arquivos(SRC);
const rel = (p: string) => p.slice(SRC.length);

test("nenhum arquivo do produto importa o seed de forma estática (só o tipo pode)", () => {
  const estaticos = TODOS.filter((p) => !p.endsWith("lib/demo/seed.ts")).filter((p) => {
    const s = readFileSync(p, "utf8");
    // `import type … from` não entra no pacote; qualquer outro `import … from` / `export … from` do seed entra.
    return /^\s*(import(?!\s+type\b)|export)\b[^;]*from\s+["'](@\/lib\/demo\/seed|\.\/seed|\.\.\/demo\/seed)["']/m.test(s);
  });
  assert.deepEqual(estaticos.map(rel), []);
});

test("o seed só é carregado sob demanda, num lugar só, e só com o modo demonstração ligado", () => {
  const dinamicos = TODOS.filter((p) => /import\(\s*["'](@\/lib\/demo\/seed|\.\/seed)["']\s*\)/.test(readFileSync(p, "utf8")));
  assert.deepEqual(dinamicos.map(rel), ["lib/demo/usar-exemplos.ts"]);
  const h = readFileSync(join(SRC, "lib/demo/usar-exemplos.ts"), "utf8");
  assert.match(h, /^"use client";/);
  // Desligado: nem pede o arquivo, e devolve null mesmo que já tenha sido carregado antes.
  assert.match(h, /if \(!ativo \|\| exemplos\) return;/);
  assert.match(h, /return ativo \? exemplos : null;/);
});

test("as oito telas que mostravam exemplos passam pelo carregador", () => {
  for (const t of [
    "app/(dashboard)/dashboard/mensagens/messages-client.tsx",
    "app/(dashboard)/dashboard/carteira/carteira-client.tsx",
    "app/(dashboard)/dashboard/imoveis/imoveis-client.tsx",
    "app/(dashboard)/dashboard/visao-geral-client.tsx",
    "app/(dashboard)/dashboard/garantias/garantias-client.tsx",
    "app/(dashboard)/dashboard/leads/leads-client.tsx",
    "app/(dashboard)/dashboard/locacoes/locacoes-client.tsx",
    "app/(dashboard)/dashboard/contratos/contratos-client.tsx",
  ]) {
    const s = readFileSync(join(SRC, t), "utf8");
    assert.match(s, /useExemplos\(/, t);
    // O seed só aparece como campo do que o carregador devolveu (exemplos.DEMO_…), nunca solto.
    assert.doesNotMatch(s, /(?<![.\w])DEMO_(CONVERSATIONS|PORTFOLIO|PROPERTIES|PROPERTY_STATS|KPIS|CONTRACTS|LEADS)\b/, `${t}: usa o seed sem passar pelo carregador`);
  }
});

test("o seed continua com os valores de exemplo (a correção é no carregamento, não nos dados)", () => {
  const seed = readFileSync(join(SRC, "lib/demo/seed.ts"), "utf8");
  assert.match(seed, /monthlyPrice: 2900/);
  assert.match(seed, /_demo: true/);
});
