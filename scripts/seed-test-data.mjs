/*
  Seed de dados de TESTE — idempotente. Cria as contas de teste (via env, nunca
  no código) e UM imóvel publicado do proprietário-teste, para a suíte E2E
  (T-TRAV) e o teste de XSS terem contra o que rodar.

  Uso:
    node scripts/seed-test-data.mjs

  Requer (env / .env.local / secrets — NUNCA commitado):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY            (service role — só no servidor/CI)
    TESTES_INQUILINO_EMAIL / _SENHA / _NOME
    TESTES_INQUILINO2_EMAIL / _SENHA / _NOME   (opcional — T-TRAV-C recusa a 2ª)
    TESTES_PROPRIETARIO_EMAIL / _SENHA / _NOME
    TESTES_ADMIN_EMAIL / _SENHA / _NOME

  SALVAGUARDA: recusa rodar contra um projeto cujo host contenha o domínio de
  produção — seed só em projeto de teste.
*/
import { createClient } from "@supabase/supabase-js";

const PROD_HOST = "vivanomads.com.br";

/** UUID fixo do imóvel semeado — torna o upsert idempotente (sem duplicar). */
const SEED_PROPERTY_ID = "11111111-1111-4111-8111-111111111111";

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Faltou ${name}. Configure as contas/segredos de TESTE.`);
    process.exit(1);
  }
  return v;
}

/** Papéis e seus mapeamentos env → papel do banco. */
const CONTAS = [
  { key: "INQUILINO", role: "tenant", required: true },
  { key: "INQUILINO2", role: "tenant", required: false },
  { key: "PROPRIETARIO", role: "owner", required: true },
  { key: "ADMIN", role: "admin", required: true },
];

function lerConta({ key, role, required }) {
  const email = process.env[`TESTES_${key}_EMAIL`];
  const senha = process.env[`TESTES_${key}_SENHA`];
  const nome = process.env[`TESTES_${key}_NOME`] ?? `Teste ${key}`;
  if (!email || !senha) {
    if (required) {
      console.error(`✗ Faltou TESTES_${key}_EMAIL/_SENHA (papel obrigatório).`);
      process.exit(1);
    }
    return null; // papel opcional ausente → pula
  }
  return { key, role, email, senha, nome };
}

/** Acha o usuário auth por e-mail (paginando listUsers), ou null. */
async function acharUsuarioPorEmail(admin, email) {
  const alvo = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const achado = data.users.find((u) => (u.email ?? "").toLowerCase() === alvo);
    if (achado) return achado;
    if (data.users.length < 200) break; // última página
  }
  return null;
}

/** Cria (ou reaproveita) o usuário auth e devolve o id. */
async function garantirUsuario(admin, conta) {
  const existente = await acharUsuarioPorEmail(admin, conta.email);
  if (existente) {
    // Garante a senha conhecida (caso tenha sido trocada) e e-mail confirmado.
    await admin.auth.admin.updateUserById(existente.id, {
      password: conta.senha,
      email_confirm: true,
      user_metadata: { full_name: conta.nome },
    });
    return existente.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: conta.email,
    password: conta.senha,
    email_confirm: true,
    user_metadata: { full_name: conta.nome },
  });
  if (error) throw error;
  return data.user.id;
}

/** Upsert do profile com o papel correto. */
async function garantirPerfil(admin, id, conta) {
  const { error } = await admin.from("profiles").upsert(
    {
      id,
      full_name: conta.nome,
      email: conta.email,
      role: conta.role,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

/** Upsert do imóvel publicado do proprietário-teste (R$ 3.200/mês). */
async function garantirImovel(admin, ownerId) {
  const { error } = await admin.from("properties").upsert(
    {
      id: SEED_PROPERTY_ID,
      owner_id: ownerId,
      title: "Studio mobiliado — conta de teste (E2E)",
      description:
        "Imóvel de teste semeado para a suíte E2E. Mobiliado, média duração (30–180 dias).",
      property_type: "Studio",
      address: "Centro",
      city: "Uberlândia",
      state: "MG",
      bedrooms: 1,
      bathrooms: 1,
      area_m2: 40,
      min_period_days: 30,
      monthly_price: 3200, // T-TRAV-D: 4 meses × 3200 = R$ 12.800
      status: "active",
      ready_to_live_badge: true,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function main() {
  const url = need("NEXT_PUBLIC_SUPABASE_URL");
  need("SUPABASE_SERVICE_ROLE_KEY");

  if (url.includes(PROD_HOST)) {
    console.error(`✗ Recusando: a URL aponta para produção (${PROD_HOST}). Seed só em teste.`);
    process.exit(1);
  }

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const contas = CONTAS.map(lerConta).filter(Boolean);
  const idPorPapel = {};

  for (const conta of contas) {
    const id = await garantirUsuario(admin, conta);
    await garantirPerfil(admin, id, conta);
    idPorPapel[conta.key] = id;
    console.log(`✓ ${conta.key} (${conta.role}) → ${conta.email}`);
  }

  await garantirImovel(admin, idPorPapel.PROPRIETARIO);
  console.log(`✓ Imóvel publicado ${SEED_PROPERTY_ID} (R$ 3.200/mês) do proprietário-teste`);

  console.log("\n✅ Seed concluído (idempotente).");
}

main().catch((e) => {
  console.error("✗ Falha no seed:", e?.message ?? e);
  process.exit(1);
});
