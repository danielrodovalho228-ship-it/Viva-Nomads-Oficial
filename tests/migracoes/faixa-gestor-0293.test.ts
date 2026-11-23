/* Roda: node --test tests/migracoes/faixa-gestor-0293.test.ts — E564: Plano Gestor = faixa de 4% (sem assinatura). */
/*
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): só o caso do SERVIDOR. Os arquivos SQL da 0293 são históricos e imutáveis —
  as asserções sobre eles não mudaram. O que mudou é o código que lia aquela faixa: o servidor não lê mais o tipo da conta para a
  taxa nem marca a faixa sem teto como "gestor"; config/planos guarda os 4% do plano antigo só como histórico (ler contratos antigos).
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAXAS_HISTORICAS, taxaDoContrato } from "../../src/config/planos.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const aplRaw = ler("supabase/producao/aplicar-0293.sql");

test("0293 (arquivo e aplicar): sai a 31+, 16–30 vira 16–19 e entra 20+ = 4%; recalcula a faixa dos donos", () => {
  for (const s of [sql(ler("supabase/migrations/0293_faixa_gestor_4.sql")), sql(aplRaw)]) {
    assert.match(s, /delete from public\.faixas_comissao where min_imoveis = 31;/);
    assert.match(s, /update public\.faixas_comissao set max_imoveis = 19 where min_imoveis = 16;/);
    assert.match(s, /values \(20, null, 0\.04\)\s*on conflict \(min_imoveis\) do update/);
    assert.match(s, /select public\.atualizar_faixas_dos_donos\(\);/);
    assert.doesNotMatch(s, /contratos|AUTOMACOES|ADMIN_2FA|VN-CT-D5D50247|auth\./i);
  }
});

test("0293: aplicar entre begin/commit e registrado; rollback volta 16–30 e 31+", () => {
  assert.match(aplRaw, /^-- [^\n]*\n-- [^\n]*\nbegin;/);
  assert.match(aplRaw, /commit;\s*$/);
  assert.match(aplRaw, /'20261105000293', '0293_faixa_gestor_4'[\s\S]*where not exists/);
  const rb = sql(ler("supabase/producao/rollback/0293_rollback.sql"));
  assert.match(rb, /delete from public\.faixas_comissao where min_imoveis = 20;/);
  assert.match(rb, /values \(31, null, 0\.06\)/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261105000293';/);
});

test("servidor (078): o tipo da conta NÃO entra mais na taxa e a faixa sem teto da tabela não é marcada como Gestor; os 4% ficam só como histórico", () => {
  const t = ler("src/lib/cobranca/taxa-servidor.ts");
  // 078 (Daniel, 16/11/2026): antes o servidor LIA o tipo da conta (/from("profiles").select("account_type").eq("id", ownerId)/);
  // agora não consulta profiles nem account_type para calcular a taxa.
  assert.doesNotMatch(t, /from\("profiles"\)|account_type/);
  // 078 (Daniel, 16/11/2026): antes passava /administradora: (perfil …)?.account_type === "gestor",/ para a regra; não passa mais.
  assert.doesNotMatch(t, /administradora\s*:|\bperfil\b/);
  // 078 (Daniel, 16/11/2026): antes marcava a faixa sem teto (/...(l.max_imoveis == null ? { gestor: true } : {}),/); a linha lida da
  // tabela vira só { minImoveis, maxImoveis, taxa }.
  assert.doesNotMatch(t, /gestor\s*:\s*true|\bgestor\b/);
  assert.match(t, /minImoveis: Number\(l\.min_imoveis\),\s*maxImoveis: l\.max_imoveis == null \? null : Number\(l\.max_imoveis\),\s*taxa: Number\(l\.taxa\),\s*\}\)\);/);
  // Sem assinatura: nada de mensalidade do Gestor na configuração.
  const planos = ler("src/config/planos.ts");
  assert.doesNotMatch(planos, /mensalBase|porImovelAdicional|imoveisInclusos|assinaturaAnualGestor/);
  // 078 (Daniel, 16/11/2026): antes /comissao: 0\.04, \/\/ E564/ (a taxa do Plano Gestor, em oferta). O 0,04 fica no plano "gestor" só
  // como HISTÓRICO — para ler contratos antigos —, sem benefício anunciado; e a leitura de contrato antigo continua dando 4%.
  assert.match(planos, /id: "gestor",[\s\S]{0,300}?\/\/ HISTÓRICO \(prompt 078, 16\/11\/2026\): o plano deixou de ser oferta pública\.[^\n]*\n[^\n]*\n\s*comissao: 0\.04,\n[\s\S]{0,120}?beneficios: \[\],/);
  assert.doesNotMatch(planos, /comissao: 0\.04, \/\/ E564/);
  assert.ok(TAXAS_HISTORICAS.includes(0.04));
  assert.equal(taxaDoContrato(0.04, null), 0.04);
  assert.equal(taxaDoContrato(null, "gestor"), 0.04);
});
