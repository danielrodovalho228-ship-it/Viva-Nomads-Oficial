/*
  EVIDÊNCIA de quais migrações estão APLICADAS no banco (produção ou preview) —
  não no código. Prova a regra: "migração não aplicada é bug fail-OPEN disfarçado
  de fail-closed". Roda contra o Supabase apontado pelas envs e reporta, por
  migração crítica, se a marca (coluna/tabela) EXISTE no banco real.

  Uso (aponte para PRODUÇÃO com o service role de produção):
    NEXT_PUBLIC_SUPABASE_URL=https://<prod>.supabase.co \
    SUPABASE_SERVICE_ROLE_KEY=<service_role_prod> \
    node scripts/check-migracoes.mjs

  Saída: uma linha por migração — ✅ APLICADA / ❌ FALTANDO — e exit code 1 se
  qualquer migração CRÍTICA (moderação/segurança) faltar.
*/
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (do ambiente ALVO).");
  process.exit(2);
}
const host = url.replace(/^https?:\/\//, "").split(".")[0];
const admin = createClient(url, key, { auth: { persistSession: false } });

// Cada checagem prova uma migração pela sua MARCA no banco (coluna ou tabela).
// `critica: true` = bloqueio de segurança do piloto (moderação de documentos).
const CHECKS = [
  { mig: "0042", desc: "moderação: document_status", table: "qualification_checklists", col: "document_status", critica: true },
  { mig: "0044", desc: "conferência: document_hash_sha256 + reviewed_by", table: "qualification_checklists", col: "document_hash_sha256", critica: true },
  { mig: "0043", desc: "rascunho: properties.draft_data", table: "properties", col: "draft_data", critica: false },
  { mig: "0045", desc: "IA: tabela ai_generations", table: "ai_generations", col: "id", critica: false },
  { mig: "0046", desc: "aceite: leads.accepted_commission_rate", table: "leads", col: "accepted_commission_rate", critica: false },
  { mig: "0047a", desc: "planos: profiles.account_type", table: "profiles", col: "account_type", critica: false },
  { mig: "0047b", desc: "planos: tabela account_type_audit", table: "account_type_audit", col: "id", critica: false },
];

/** Aplicada? Tenta ler a marca; erro de coluna/tabela ausente = FALTANDO. */
async function aplicada({ table, col }) {
  const { error } = await admin.from(table).select(col, { head: true, count: "exact" }).limit(1);
  if (!error) return true;
  const msg = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  // 42703 = coluna inexistente; 42P01 = tabela inexistente; PGRST = schema cache.
  if (/42703|42p01|does not exist|could not find|schema cache/.test(msg)) return false;
  throw error; // erro inesperado (rede/permissão) — não mascara como "faltando"
}

async function main() {
  console.log(`\nAlvo: ${host}  (${url})\n`);
  let faltaCritica = false;
  for (const c of CHECKS) {
    let ok;
    try {
      ok = await aplicada(c);
    } catch (e) {
      console.log(`⚠️  ${c.mig}  ERRO ao checar (${c.desc}): ${e.message ?? e}`);
      if (c.critica) faltaCritica = true;
      continue;
    }
    const tag = ok ? "✅ APLICADA" : "❌ FALTANDO";
    const crit = c.critica ? " [CRÍTICA]" : "";
    console.log(`${tag}${crit}  ${c.mig} — ${c.desc}`);
    if (!ok && c.critica) faltaCritica = true;
  }

  if (faltaCritica) {
    console.error(
      "\n🚨 FAIL-OPEN: migração CRÍTICA de moderação FALTA no banco alvo. O portão " +
        "de publicar depende dessas colunas — aplique 0042 e 0044 antes do piloto.\n"
    );
    process.exit(1);
  }
  console.log("\n✅ Todas as migrações críticas de moderação estão aplicadas no alvo.\n");
}

main().catch((e) => {
  console.error("✗ Falha ao checar migrações:", e?.message ?? e);
  process.exit(2);
});
