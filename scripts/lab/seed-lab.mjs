/*
  LABORATÓRIO — dados de teste determinísticos no Supabase LOCAL (nunca produção).

  Personas (e-mails no domínio reservado .test — nunca chegam a ninguém):
    Ana (3 inquilinas), Paulo (proprietário: Gratuito, Essencial, Profissional,
    Gestor com 20 imóveis aprovados), Roberta (admin), Gustavo (o "invasor"
    dos testes de segurança, conta de inquilino comum).
  Imóveis com 8 fotos geradas (cômodos em cores, sem pessoas).

  Senha: UMA por noite, gerada pelo workflow (LAB_SENHA) e nunca gravada no
  repositório. Saídas:
    • GITHUB_ENV (quando existir): TESTES_* para a suíte E2E existente;
    • tests/laboratorio/saida/contas.json: só papéis e e-mails (sem senha).

  Uso: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… LAB_SENHA=… node scripts/lab/seed-lab.mjs
*/
import { createClient } from "@supabase/supabase-js";
import { deflateSync } from "node:zlib";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const senha = process.env.LAB_SENHA ?? "";

// TRAVA: só banco LOCAL. (O banco de produção é *.supabase.co, não o domínio do site.)
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["127.0.0.1", "localhost"].includes(host)) {
  console.error(`✗ Recusando: o laboratório só semeia o Supabase LOCAL (127.0.0.1/localhost). URL recebida: ${host || "(vazia)"}`);
  process.exit(1);
}
if (!chave || senha.length < 16) {
  console.error("✗ Faltou SUPABASE_SERVICE_ROLE_KEY ou LAB_SENHA (mínimo 16 caracteres).");
  process.exit(1);
}

const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

export const PERSONAS = [
  { chave: "INQUILINO", email: "ana.lima@lab.vivanomads.test", nome: "Ana Lima", role: "tenant" },
  { chave: "INQUILINO2", email: "ana.costa@lab.vivanomads.test", nome: "Ana Costa", role: "tenant" },
  { chave: "INQUILINO3", email: "ana.souza@lab.vivanomads.test", nome: "Ana Souza", role: "tenant" },
  { chave: "PROPRIETARIO_GRATUITO", email: "paulo.gratuito@lab.vivanomads.test", nome: "Paulo Gratuito", role: "owner", plano: null },
  { chave: "PROPRIETARIO", email: "paulo.essencial@lab.vivanomads.test", nome: "Paulo Essencial", role: "owner", plano: "essential" },
  { chave: "PROPRIETARIO_PRO", email: "paulo.profissional@lab.vivanomads.test", nome: "Paulo Profissional", role: "owner", plano: "pro" },
  { chave: "PROPRIETARIO_GESTOR", email: "paulo.gestor@lab.vivanomads.test", nome: "Paulo Gestor", role: "owner", plano: null, gestor: true },
  { chave: "ADMIN", email: "roberta@lab.vivanomads.test", nome: "Roberta Admin", role: "admin" },
  { chave: "INVASOR", email: "gustavo@lab.vivanomads.test", nome: "Gustavo Teste", role: "tenant" },
];

// ── PNG simples (cor sólida com faixas), sem dependências ───────────────────
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tipo, dados) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, [r, g, b]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    const faixa = Math.floor(y / (h / 6)) % 2 ? 0.85 : 1; // "piso/parede"
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r * faixa;
      raw[o + 1] = g * faixa;
      raw[o + 2] = b * faixa;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const COMODOS = [
  ["sala", [196, 170, 140]], ["quarto", [150, 170, 200]], ["cozinha", [210, 200, 160]], ["banheiro", [170, 205, 210]],
  ["varanda", [160, 190, 150]], ["home-office", [190, 180, 200]], ["area-servico", [200, 190, 180]], ["fachada", [180, 180, 170]],
];

async function urlsDasFotos() {
  const urls = [];
  for (const [nome, cor] of COMODOS) {
    const caminho = `lab/${nome}.png`;
    const { error } = await admin.storage.from("property-photos").upload(caminho, png(640, 480, cor), { contentType: "image/png", upsert: true });
    if (error) throw error;
    urls.push(admin.storage.from("property-photos").getPublicUrl(caminho).data.publicUrl);
  }
  return urls;
}

async function garantirUsuario(p) {
  const { data, error } = await admin.auth.admin.createUser({ email: p.email, password: senha, email_confirm: true, user_metadata: { full_name: p.nome } });
  if (error) throw new Error(`${p.email}: ${error.message}`);
  const id = data.user.id;
  const { error: e2 } = await admin
    .from("profiles")
    .upsert({ id, email: p.email, full_name: p.nome, role: p.role, ...(p.gestor ? { account_type: "gestor" } : {}) }, { onConflict: "id" });
  if (e2) throw new Error(`perfil ${p.email}: ${e2.message}`);
  if (p.plano) {
    const { error: e3 } = await admin.from("subscriptions").insert({ owner_id: id, plan: p.plano, status: "active", gateway: "asaas" });
    if (e3) throw new Error(`assinatura ${p.email}: ${e3.message}`);
  }
  return id;
}

async function criarImovel(ownerId, i, fotos, extra = {}) {
  const { data, error } = await admin
    .from("properties")
    .insert({
      owner_id: ownerId,
      title: `Imóvel mobiliado de teste ${i} — laboratório`,
      description: "Imóvel de teste do laboratório: mobiliado, com home office, internet e cozinha completa. Pronto para morar.",
      property_type: "Studio",
      address: "Centro",
      city: "Uberlândia",
      state: "MG",
      bedrooms: 1,
      bathrooms: 1,
      area_m2: 40,
      max_guests: 2,
      min_period_days: 30,
      max_period_days: 180,
      monthly_price: 3200,
      status: "active",
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw new Error(`imóvel ${i}: ${error.message}`);
  const { error: e2 } = await admin.from("property_photos").insert(fotos.map((u, k) => ({ property_id: data.id, url: u, sort_order: k })));
  if (e2) throw new Error(`fotos ${i}: ${e2.message}`);
  await admin.from("properties").update({ photo_count: fotos.length }).eq("id", data.id);
  return data.id;
}

async function main() {
  const fotos = await urlsDasFotos();
  const ids = {};
  for (const p of PERSONAS) {
    ids[p.chave] = await garantirUsuario(p);
    console.log(`✓ ${p.chave.padEnd(22)} ${p.email}`);
  }
  // Paulo Essencial: o imóvel publicado da suíte E2E (R$ 3.200/mês).
  await criarImovel(ids.PROPRIETARIO, 1, fotos, { ready_to_live_badge: true });
  await criarImovel(ids.PROPRIETARIO_GRATUITO, 2, fotos);
  await criarImovel(ids.PROPRIETARIO_PRO, 3, fotos);
  // Paulo Gestor: 20 imóveis com documentação APROVADA (elegível ao Gestor).
  for (let i = 0; i < 20; i++) {
    const pid = await criarImovel(ids.PROPRIETARIO_GESTOR, 100 + i, fotos);
    const { error } = await admin
      .from("qualification_checklists")
      .insert({ property_id: pid, owner_id: ids.PROPRIETARIO_GESTOR, document_status: "approved", document_reviewed_at: new Date().toISOString() });
    if (error) throw new Error(`qualificação ${i}: ${error.message}`);
  }
  console.log("✓ imóveis: 3 avulsos + 20 do Gestor (8 fotos cada)");

  // Saídas: env para a suíte E2E (sem imprimir a senha) + lista de contas sem senha.
  const ge = process.env.GITHUB_ENV;
  if (ge) {
    for (const p of PERSONAS) {
      appendFileSync(ge, `TESTES_${p.chave}_EMAIL=${p.email}\nTESTES_${p.chave}_SENHA=${senha}\nTESTES_${p.chave}_NOME=${p.nome}\n`);
    }
  }
  mkdirSync("tests/laboratorio/saida", { recursive: true });
  writeFileSync("tests/laboratorio/saida/contas.json", JSON.stringify(PERSONAS.map(({ chave, email, nome, role }) => ({ chave, email, nome, role })), null, 2));
  console.log("\n✅ Laboratório semeado.");
}

main().catch((e) => {
  console.error("✗ Falha no seed do laboratório:", e?.message ?? e);
  process.exit(1);
});
