/*
  Item 5 do pacote de segurança: o plano de CPF/CNPJ/telefone cobre TODA coluna
  sensível criada pelas migrações. Coluna nova sem entrar no plano = teste vermelho.
  Roda: node --test src/lib/seguranca/plano-dados-pessoais.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const raiz = new URL("../../../", import.meta.url);
const plano = readFileSync(new URL("docs/plano-dados-pessoais.md", raiz), "utf8");
const SENSIVEL = /^(cpf|cnpj|phone|telefone|doc_number|.*_doc|.*_telefone)$/;
// Colunas que casam com o padrão mas não guardam dado pessoal.
const NAO_PESSOAL = new Set(["notif_whatsapp"]);

test("toda coluna sensível das migrações está no plano", () => {
  const pasta = new URL("supabase/migrations/", raiz);
  const achadas = new Set<string>();
  for (const f of readdirSync(pasta).filter((n) => n.endsWith(".sql"))) {
    const sql = readFileSync(new URL(f, pasta), "utf8").toLowerCase();
    for (const m of sql.matchAll(/(?:add column(?: if not exists)?|^\s+)\s*([a-z_]+)\s+(?:text|varchar|bytea)\b/gm)) {
      const col = m[1];
      if (SENSIVEL.test(col) && !NAO_PESSOAL.has(col)) achadas.add(col);
    }
  }
  assert.ok(achadas.size >= 5, `poucas colunas achadas: ${[...achadas]}`);
  for (const col of achadas) assert.ok(plano.includes(col), `coluna ${col} não está em docs/plano-dados-pessoais.md`);
});

test("plano é só plano: recomenda A antes do lançamento e B depois, descarta pgsodium", () => {
  assert.match(plano, /PLANO — nada aplicado/);
  assert.match(plano, /Fase 1 \(antes do lançamento\) — opção A/);
  assert.match(plano, /Fase 2 .* — opção B/);
  assert.match(plano, /pgsodium/);
});
