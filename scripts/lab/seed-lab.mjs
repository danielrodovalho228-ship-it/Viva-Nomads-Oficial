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

  Contrato: Paulo Essencial × Ana Souza no imóvel 1 (60 dias, comissão 8% do
  1º aluguel), para as telas de contrato terem dado REAL (sem modo demo).

  Rodar de novo no mesmo banco: as personas do laboratório (só e-mails
  @lab.vivanomads.test) são apagadas antes — a trava abaixo garante que isso só
  acontece no Supabase LOCAL.

  Uso: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… LAB_SENHA=… node scripts/lab/seed-lab.mjs
*/
import { createClient } from "@supabase/supabase-js";
import { deflateSync } from "node:zlib";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

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

/**
 * Apaga as personas de uma rodada anterior (só e-mails do domínio reservado do
 * laboratório). O apagar em auth.users leva junto perfil, imóveis e o resto em
 * cascata. Só chega aqui depois da trava de banco LOCAL lá em cima.
 */
async function limparPersonas() {
  const emails = new Set(PERSONAS.map((p) => p.email));
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listar usuários: ${error.message}`);
  const antigos = (data?.users ?? []).filter((u) => u.email && emails.has(u.email) && u.email.endsWith("@lab.vivanomads.test"));
  for (const u of antigos) {
    // Imóveis antes do usuário: apagar em cascata pelo Auth esbarra no gatilho
    // recalc_listing_quality, que o serviço de Auth não pode executar.
    // Chamados também: a regra chamados_check (dono OU e-mail de visitante)
    // impede o "set null" da exclusão — achado P1, correção em migração própria.
    await admin.from("chamados").delete().eq("usuario_id", u.id);
    const { error: eImoveis } = await admin.from("properties").delete().eq("owner_id", u.id);
    if (eImoveis) throw new Error(`apagar imóveis de ${u.email}: ${eImoveis.message}`);
    const { error: e } = await admin.auth.admin.deleteUser(u.id);
    if (e) throw new Error(`apagar ${u.email}: ${e.message || e.code || "erro do Auth"}`);
  }
  if (antigos.length) console.log(`✓ ${antigos.length} persona(s) da rodada anterior apagada(s)`);
}

/** Contrato real (sem demo) para as telas de contrato: 60 dias, 1 bloco ativo de 2 meses. */
async function criarContrato(propertyId, tenantId) {
  const aluguel = 3200;
  const pct = 0.08; // Essencial (config/planos)
  const hoje = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const inicio = new Date(hoje.getTime() - 10 * 86400000);
  const fim = new Date(inicio.getTime() + 59 * 86400000);
  const { data, error } = await admin
    .from("contratos")
    .insert({
      property_id: propertyId,
      tenant_id: tenantId,
      owner_plan: "essential",
      faixa: "temporada",
      prazo_total_dias: 60,
      aluguel_mensal: aluguel,
      tamanho_bloco_meses: 2,
      comissao_percent: pct,
      comissao_valor: aluguel * pct,
      qtd_ocupantes: 1,
      status: "ativo",
      garantia: "caucao",
    })
    .select("id")
    .single();
  if (error) throw new Error(`contrato: ${error.message}`);
  const { error: e2 } = await admin.from("contrato_blocos").insert({
    contrato_id: data.id,
    numero_bloco: 1,
    inicio: iso(inicio),
    fim: iso(fim),
    meses: 2,
    valor: aluguel * 2,
    caucao: aluguel,
    status: "ativo",
  });
  if (e2) throw new Error(`bloco do contrato: ${e2.message}`);
  return data.id;
}

// CPF de teste VÁLIDO (dígitos certos) e único por persona: o aceite, a assinatura
// e o fechamento exigem o documento (0090). O T31 apaga e devolve o de uma persona.
function cpfLab(n) {
  const base = String(310000000 + n * 7919).slice(0, 9).split("").map(Number);
  const dv = (d) => {
    const r = (d.reduce((s, x, i) => s + x * (d.length + 1 - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  base.push(dv(base));
  base.push(dv(base));
  return base.join("");
}

async function garantirUsuario(p) {
  const { data, error } = await admin.auth.admin.createUser({ email: p.email, password: senha, email_confirm: true, user_metadata: { full_name: p.nome } });
  if (error) throw new Error(`${p.email}: ${error.message}`);
  const id = data.user.id;
  const { error: e2 } = await admin
    .from("profiles")
    .upsert({ id, email: p.email, full_name: p.nome, role: p.role, cpf: cpfLab(PERSONAS.indexOf(p) + 1), ...(p.gestor ? { account_type: "gestor" } : {}) }, { onConflict: "id" });
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
  await limparPersonas();
  const fotos = await urlsDasFotos();
  const ids = {};
  for (const p of PERSONAS) {
    ids[p.chave] = await garantirUsuario(p);
    console.log(`✓ ${p.chave.padEnd(22)} ${p.email}`);
  }
  // Paulo Essencial: o imóvel publicado da suíte E2E (R$ 3.200/mês).
  const imovel1 = await criarImovel(ids.PROPRIETARIO, 1, fotos, { ready_to_live_badge: true });
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
  const contratoId = await criarContrato(imovel1, ids.INQUILINO3);
  console.log("✓ contrato: Paulo Essencial × Ana Souza (60 dias, comissão 8%)");
  // Documento de verdade para a conferência pública (/conferir/<código>):
  // informe anual, o único tipo que não exige pagamento ou acerto.
  const codigoConferir = randomBytes(16).toString("hex");
  const { error: eDoc } = await admin.from("documentos_fiscais").insert({
    tipo: "informe_anual",
    numero: `INF-LAB-${Date.now()}`,
    ano: new Date().getFullYear(),
    contrato_id: contratoId,
    owner_id: ids.PROPRIETARIO,
    tenant_id: ids.INQUILINO3,
    locador_nome: "Paulo Essencial",
    locatario_nome: "Ana Souza",
    valor: 3200,
    hash: randomBytes(32).toString("hex"),
    codigo_verificacao: codigoConferir,
    pdf_path: "lab/informe-de-teste.pdf",
  });
  if (eDoc) throw new Error(`documento de teste: ${eDoc.message}`);
  console.log("✓ documento de teste para /conferir");

  // Rondas de teste da Central de Agentes (só no banco local; marcadas [lab]).
  await admin.from("agentes_rondas").delete().like("resumo", "[lab]%");
  const minAtras = (m) => new Date(Date.now() - m * 60_000).toISOString();
  const rondasLab = [
    ["bruno", 5, "alerta", "[lab] Varri site, banco e Vercel. Duas coisas para a fila.", [{ prioridade: "P1", titulo: "Função sem search_path no Supabase" }, { prioridade: "P2", titulo: "Sitemap com URL que dá 404" }]],
    ["otavio", 180, "ok", "[lab] Conferi em produção os 3 itens do último pacote; todos verificados.", []],
    ["carla", 60, "ok", "[lab] Relatório do dia: 0 contratos novos, 2 pedidos, 23 imóveis (dados de teste).", []],
    ["helena", 240, "alerta", "[lab] Pendências do Daniel atualizadas.", [{ prioridade: "P2", titulo: "Contador ainda não respondeu sobre o CNPJ" }]],
    ["rafael", 600, "ok", "[lab] SEO: páginas de cidade indexáveis.", [{ prioridade: "P3", titulo: "Título da home com 70 caracteres" }]],
    ["marina", 2880, "falhou", "[lab] A ronda parou antes de ler os saldos dos serviços.", []],
  ];
  for (const [slug, m, status, resumo, achados] of rondasLab) {
    const { error } = await admin.from("agentes_rondas").insert({ agente_slug: slug, iniciada_em: minAtras(m), concluida_em: minAtras(m - 2), status, resumo, achados });
    if (error) throw new Error(`ronda ${slug}: ${error.message}`);
  }
  // Como em produção: a Viva está no ar (chat da /ajuda), sem tarefa agendada.
  await admin.from("agentes").update({ status: "ativo", rotina_texto: "No site, 24 h (chat da /ajuda)", trigger_id: null }).eq("slug", "viva");
  console.log("✓ rondas de teste da Central de Agentes");

  // Saídas: env para a suíte E2E (sem imprimir a senha) + lista de contas sem senha.
  const ge = process.env.GITHUB_ENV;
  if (ge) {
    for (const p of PERSONAS) {
      appendFileSync(ge, `TESTES_${p.chave}_EMAIL=${p.email}\nTESTES_${p.chave}_SENHA=${senha}\nTESTES_${p.chave}_NOME=${p.nome}\n`);
    }
    appendFileSync(ge, `TESTES_CONFERIR_CODIGO=${codigoConferir}\n`);
  }
  mkdirSync("tests/laboratorio/saida", { recursive: true });
  writeFileSync("tests/laboratorio/saida/contas.json", JSON.stringify(PERSONAS.map(({ chave, email, nome, role }) => ({ chave, email, nome, role })), null, 2));
  console.log("\n✅ Laboratório semeado.");
}

main().catch((e) => {
  console.error("✗ Falha no seed do laboratório:", e?.message ?? e);
  process.exit(1);
});
