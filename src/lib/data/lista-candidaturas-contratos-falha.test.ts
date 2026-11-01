/*
  Auditoria de erros e estados vazios — achado nº 7: "Minhas candidaturas" (morador) e "Contratos" (dono e morador)
  mostravam "nenhuma" quando a leitura do banco falhava — quem tinha um contrato a assinar não via. Agora as duas telas
  pedem com `exigir`: a falha lança e o painel mostra "Não conseguimos abrir esta tela" com "Tentar de novo". Home, Ganhos,
  Garantias e carteira seguem sem `exigir`.
  Roda: node --test src/lib/data/lista-candidaturas-contratos-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("candidaturas e contratos lançam na falha do banco quando a tela pede com exigir", () => {
  const cand = ler("src/lib/data/leads-actions.ts");
  assert.match(cand, /export async function listMinhasCandidaturas\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(cand, /if \(error && opcoes\.exigir\) throw new Error\(MSG_CANDIDATURAS_NAO_CARREGARAM\);\n\s*if \(error \|\| !data\) return \[\];/);
  const ctr = ler("src/lib/data/contratos-actions.ts");
  for (const fn of ["getContratosDoInquilino", "getMeusContratos"]) assert.match(ctr, new RegExp(`export async function ${fn}\\(opcoes: \\{ exigir\\?: boolean \\} = \\{\\}\\)`), fn);
  assert.equal([...ctr.matchAll(/if \(error && opcoes\.exigir\) throw new Error\(MSG_CONTRATOS_NAO_CARREGARAM\);/g)].length, 2);
  // A lista de imóveis de que os contratos do dono dependem também não pode virar "nenhum" calado.
  assert.match(ctr, /const props = await listMyProperties\(\{ exigir: opcoes\.exigir \}\);/);
});

test("as telas pedem com exigir; home e ganhos não (Garantias passou a exigir no achado nº 11)", () => {
  assert.match(ler("src/app/(dashboard)/dashboard/candidaturas/page.tsx"), /listMinhasCandidaturas\(\{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/dashboard/contratos/page.tsx"), /getMeusContratos\(\{ exigir: true \}\), getContratosDoInquilino\(\{ exigir: true \}\), listMyProperties\(\{ exigir: true \}\)/);
  for (const f of ["src/app/(dashboard)/dashboard/page.tsx", "src/app/(dashboard)/dashboard/ganhos/page.tsx", "src/lib/data/carteira.ts"]) {
    assert.doesNotMatch(ler(f), /exigir: true/, f);
  }
});
