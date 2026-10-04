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
  { mig: "0048", desc: "push: tabela push_tokens", table: "push_tokens", col: "id", critica: false },
];

/*
  C4 (0053) — properties usa GRANT POR COLUNA. Coluna nova em properties que
  NÃO entrar no grant (e em PROPERTY_PUBLIC_COLUMNS, src/lib/data/properties.ts)
  some do site sem erro claro. Este aviso compara as colunas reais da tabela com
  as listas conhecidas e aponta qualquer coluna "órfã".
*/
const PROPERTIES_PUBLICAS = [
  "id", "owner_id", "title", "description", "property_type", "city", "state", "address",
  "lat", "lng", "bedrooms", "bathrooms", "area_m2", "min_period_days", "monthly_price",
  "utilities_mode", "utilities_estimate", "utilities_overage_margin", "prep_fee",
  "checkout_cleaning_enabled", "checkout_cleaning_fee", "issues_invoice",
  "accepts_insurance", "rating", "review_count", "status", "ready_to_live_badge",
  "ready_to_live_score", "tag_home_office", "tag_work_located", "tag_condo_approved",
  "ownership_type", "sublease_authorized", "video_url", "created_at", "faixas_aceitas",
  "garantias_aceitas", "google_places", "parking_spots", "condo_fee",
  "descricao_gerada_por_ia", "available_from", "furnished", "pets_allowed",
  "smoking_allowed", "children_allowed", "max_guests", "available_until",
  "max_period_days", "checkin_after", "checkout_before",
];
// Privadas de propósito (fora do grant; só via RPC property_private_details).
const PROPERTIES_PRIVADAS = [
  "exact_address", "responsavel_local_nome", "responsavel_local_telefone",
  "responsavel_local_email", "responsavel_local_user_id", "draft_data", "sublease_doc_url",
];

/** Lista as colunas reais de properties (amostra de 1 linha via service role). */
async function colunasDeProperties() {
  const { data, error } = await admin.from("properties").select("*").limit(1);
  if (error || !data || data.length === 0) return null; // tabela vazia: não dá p/ inferir
  return Object.keys(data[0]);
}

async function avisoGrantProperties() {
  let cols;
  try {
    cols = await colunasDeProperties();
  } catch {
    cols = null;
  }
  if (!cols) {
    console.log("ℹ️  properties: sem linha para inferir colunas — aviso de grant pulado.");
    return;
  }
  const conhecidas = new Set([...PROPERTIES_PUBLICAS, ...PROPERTIES_PRIVADAS]);
  const orfas = cols.filter((c) => !conhecidas.has(c));
  if (orfas.length === 0) {
    console.log("✅ properties: todas as colunas estão no grant público ou na lista privada.");
  } else {
    console.log(
      `⚠️  properties: coluna(s) FORA do grant da 0053: ${orfas.join(", ")}.\n` +
        "    Sem grant, ela SOME do site (anon/authenticated não leem). Se for pública,\n" +
        "    inclua no GRANT SELECT de uma nova migração E em PROPERTY_PUBLIC_COLUMNS;\n" +
        "    se for privada, exponha só pela RPC property_private_details."
    );
  }
}

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

  console.log("");
  await avisoGrantProperties();

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
