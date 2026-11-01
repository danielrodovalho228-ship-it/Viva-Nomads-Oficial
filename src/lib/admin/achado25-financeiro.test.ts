/*
  Achado nº 25 (erros/estados vazios) — Admin → Financeiro. As leituras de taxas vencidas e cobranças engoliam o erro
  (`data ?? []`): o admin via "0 taxas vencidas" e toda taxa como "sem cobrança" ("Taxa a receber" inflado). Agora elas
  LANÇAM, os contratos lançam com `exigir`, e a tela mostra um aviso por leitura que falhou.
  Roda: node --test src/lib/admin/achado25-financeiro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_FIN_CONTRATOS, MSG_FIN_COBRANCAS, MSG_FIN_VENCIDAS } from "./financeiro-avisos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("taxas vencidas e cobranças lançam na falha; contratos lançam com exigir", () => {
  const f = ler("src/lib/data/admin-indicadores.ts");
  assert.match(f, /if \(error\) throw new Error\("Não foi possível ler as taxas vencidas\."\)/);
  assert.match(f, /if \(error\) throw new Error\("Não foi possível ler as cobranças das taxas\."\)/);
  assert.match(f, /if \(error && opcoes\.exigir\) throw new Error\("Não foi possível ler os contratos\."\)/);
});

test("o Financeiro registra cada falha e mostra o aviso (nunca vazio calado)", () => {
  const pg = ler("src/app/(dashboard)/admin/financeiro/page.tsx");
  assert.match(pg, /contratosReais\(admin, intervaloBRT\(periodo\.inicio, periodo\.fim\), cidade, recorte, \{ exigir: true \}\)\.catch\(\s*falhou\(MSG_FIN_CONTRATOS, null\)/);
  assert.match(pg, /taxasVencidas\(admin, recorte\)\.catch\(falhou\(MSG_FIN_VENCIDAS, null\)\)/);
  assert.match(pg, /cobrancasTaxa\(admin, contratos\.map\(\(c\) => c\.leadId \?\? ""\)\)\.catch\(falhou\(MSG_FIN_COBRANCAS,/);
  assert.doesNotMatch(pg, /taxasVencidas\(admin, recorte\)\.catch\(\(\) => \[\]\)/);
  assert.match(pg, /avisosLeitura=\{avisosLeitura\}/);
  const cli = ler("src/app/(dashboard)/admin/financeiro/financeiro-client.tsx");
  assert.match(cli, /avisosLeitura\.map\(\(t\) => \(\s*<p key=\{t\} role="alert" data-testid="fin-aviso-leitura"/);
  for (const m of [MSG_FIN_CONTRATOS, MSG_FIN_VENCIDAS, MSG_FIN_COBRANCAS]) assert.match(m, /^Não foi possível ler /);
});

test("os outros chamadores de taxasVencidas já capturam a falha (decisões e visão geral)", () => {
  assert.match(ler("src/lib/data/admin-decisoes.ts"), /ler\(taxasVencidas\(admin, "real"\)\)/);
  assert.match(ler("src/lib/data/admin-visao-geral.ts"), /taxasVencidas\(admin, "real"\)\.catch\(\(\) => null\)/);
});
