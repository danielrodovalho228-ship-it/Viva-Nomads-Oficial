/*
  F40 — o desenho da assinatura: página de detalhe, servidor valida e grava, avaliar só na janela.
  Roda: node --test src/lib/contrato-assinar-fluxo.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const acao = ler("./data/contrato-assinar-actions.ts");
const locacoes = ler("../app/(dashboard)/dashboard/locacoes/locacoes-client.tsx");
const contratos = ler("../app/(dashboard)/dashboard/contratos/contratos-client.tsx");
const migracao = ler("../../supabase/migrations/0111_contrato_assinaturas_registro.sql");

test("servidor: exige sessão, papel, aceite e grava quem/quando/IP/hash só pelo service role", () => {
  assert.match(acao, /auth\.getUser\(\)/);
  assert.match(acao, /motivoNaoPodeAssinar\(/);
  assert.match(acao, /admin\.from\("contrato_assinaturas"\)\.insert/);
  assert.match(acao, /hash_documento: hashResumo\(/);
  assert.match(acao, /\.is\(coluna, null\)/); // não sobrescreve assinatura existente
  assert.match(acao, /x-forwarded-for/);
});

test("telas: título e botão levam ao detalhe nos dois painéis; Avaliar só com a janela aberta", () => {
  assert.match(locacoes, /\/dashboard\/locacoes\/\$\{l\.id\}/);
  assert.match(locacoes, /Ver e assinar contrato/);
  assert.match(locacoes, /\(l\.podeAvaliar \|\| demoOn\) &&/);
  assert.match(contratos, /\/dashboard\/contratos\/\$\{contrato\.id\}/); // dono: rota própria (ordem f375fdc1)
  assert.match(acao, /\/dashboard\/contratos\/\$\{c\.id\}/); // aviso ao dono abre a tela do dono
});

test("migração 0111: RLS ligado, sem escrita pelo navegador, uma assinatura por papel", () => {
  assert.match(migracao, /enable row level security/);
  assert.match(migracao, /revoke insert, update, delete on public\.contrato_assinaturas from anon, authenticated/);
  assert.match(migracao, /unique \(contrato_id, papel\)/);
});
