import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NO_LABORATORIO, URL_SUPABASE, CHAVE_ANON } from "../fixtures/laboratorio";

/**
 * T50 — RLS de TODAS as tabelas public com a chave anon (a chave é pública: é o que
 * qualquer visitante tem). Só roda no laboratório (banco local semeado).
 * A lista de tabelas vem das migrações, então tabela nova entra sozinha no teste.
 *
 * - INSERT/UPDATE/DELETE anônimo: nunca pode alterar linha.
 * - SELECT anônimo: tabela fora de LEITURA_PUBLICA não pode devolver linha.
 * Escrita é só tentativa recusada; o laboratório descarta o banco toda noite.
 */
const LEITURA_PUBLICA = new Set([
  // vitrine pública: imóveis publicados, cidades, avaliações públicas, planos
  "properties", "property_photos", "cities", "reviews", "plans", "planos",
]);

function tabelasDasMigracoes(): string[] {
  const dir = join(process.cwd(), "supabase/migrations");
  const nomes = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
    const sql = readFileSync(join(dir, f), "utf8");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?\s*\(/gi)) nomes.add(m[1].toLowerCase());
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)) nomes.delete(m[1].toLowerCase());
  }
  return [...nomes].sort();
}

test.describe("T50 RLS anon em todas as tabelas @seguranca", () => {
  test.skip(!NO_LABORATORIO || !CHAVE_ANON, "Só no laboratório (Supabase local + chave anon).");

  const tabelas = tabelasDasMigracoes();

  test("as migrações listam tabelas (sanidade)", () => {
    expect(tabelas.length).toBeGreaterThan(30);
  });

  for (const t of tabelas) {
    test(`anon em ${t}`, async () => {
      const sb = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });

      const sel = await sb.from(t).select("*").limit(1);
      if (!LEITURA_PUBLICA.has(t)) {
        expect(sel.data ?? [], `anon leu linha de ${t}`).toHaveLength(0);
      }

      // Escrita: não pode afetar linha alguma. Erro (RLS/grant) ou 0 linhas afetadas, ambos ok.
      const ins = await sb.from(t).insert({}).select();
      expect(ins.data ?? [], `anon inseriu em ${t}`).toHaveLength(0);
      const upd = await sb.from(t).update({ id: null }).not("id", "is", null).select();
      expect(upd.data ?? [], `anon atualizou ${t}`).toHaveLength(0);
      const del = await sb.from(t).delete().not("id", "is", null).select();
      expect(del.data ?? [], `anon apagou de ${t}`).toHaveLength(0);
    });
  }
});
