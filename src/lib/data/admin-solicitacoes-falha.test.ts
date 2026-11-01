/*
  Auditoria de erros e estados vazios — achado nº 19: em /admin/solicitacoes (manutenção), as quatro listas — período,
  urgentes sem resposta há 4 h, fora do prazo de solução e pedidos de reclassificação — viravam "nenhuma" quando a
  leitura do banco falhava (um urgente de manutenção passaria sem ninguém ver). Agora a página pede com `exigir`: a falha
  lança e o admin mostra "Não conseguimos abrir esta tela" com "Tentar de novo". Os contadores da visão geral seguem
  sem `exigir`.
  Roda: node --test src/lib/data/admin-solicitacoes-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("as quatro leituras lançam na falha quando pedem com exigir", () => {
  const p59 = ler("src/lib/data/admin-prazos-59.ts");
  const ind = ler("src/lib/data/admin-indicadores.ts");
  const n = [...p59.matchAll(/if \(error && opcoes\.exigir\) throw new Error\(/g)].length + [...ind.matchAll(/if \(error && opcoes\.exigir\) throw new Error\(/g)].length;
  assert.ok(n >= 4, `esperava 4 leituras com exigir, achei ${n}`);
  assert.match(p59, /ordensForaDoPrazo\(admin, agora, opcoes\)/);
});

test("a página /admin/solicitacoes pede as quatro listas com exigir", () => {
  const pg = ler("src/app/(dashboard)/admin/solicitacoes/page.tsx");
  for (const re of [/manutencaoForaDoPrazo\(admin, agora, \{ exigir: true \}\)/, /pedidosDeReclassificacao\(admin, \{ exigir: true \}\)/, /urgentesSemResposta4h\(admin, \{ exigir: true \}\)/, /solicitacoesManutencao\(admin, intervaloBRT\(p\.inicio, p\.fim\), cidade, \{ exigir: true \}\)/]) {
    assert.match(pg, re);
  }
});
