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

  Contrato: Paulo Essencial × Ana Souza no imóvel 1 (60 dias, comissão 8% sobre o
  valor total do contrato = aluguel × 2 meses), para as telas de contrato terem dado REAL (sem modo demo).

  Rodar de novo no mesmo banco: as personas do laboratório (só e-mails
  @lab.vivanomads.test) são apagadas antes — a trava abaixo garante que isso só
  acontece no Supabase LOCAL.

  Uso: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… LAB_SENHA=… node scripts/lab/seed-lab.mjs
*/
import { createClient } from "@supabase/supabase-js";
import { deflateSync } from "node:zlib";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { ativarTotp } from "./totp.mjs";

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
  // Fixtures da Pista 3 (DUET-RONDA-0730/0549): t2050 (dono PJ que emite nota, 1 anúncio ativo) e t2045 (parceiros
  // publicados, requisitos da Pista 3 no #3901: A só galeria (capa = 1ª foto da galeria), B com capa, C só foto de perfil).
  { chave: "PROPRIETARIO_PJ_NOTA", email: "dora.nota@lab.vivanomads.test", nome: "Dora Nota", role: "owner" },
  { chave: "PARCEIRO_CAPA", email: "lia.capa@lab.vivanomads.test", nome: "Lia Capa", role: "tenant" },
  { chave: "PARCEIRO_GALERIA", email: "gil.galeria@lab.vivanomads.test", nome: "Gil Galeria", role: "tenant" },
  { chave: "PARCEIRO_FOTO", email: "caio.foto@lab.vivanomads.test", nome: "Caio Foto", role: "tenant" },
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
    // Parceiros do t2045: galeria antes do parceiro, parceiro antes do usuário (como a massa da varredura).
    const { data: parcs } = await admin.from("parceiros").select("id").eq("user_id", u.id);
    for (const pc of parcs ?? []) await admin.from("parceiro_galeria").delete().eq("parceiro_id", pc.id);
    await admin.from("parceiros").delete().eq("user_id", u.id);
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
      comissao_valor: aluguel * 2 * pct, // valor total (2 meses) × taxa
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

// A admin do lab liga os alertas operacionais (padrão da coluna é false): sem isso avisarEquipe não manda o e-mail do chamado (t24/t30).
async function garantirUsuario(p) {
  const { data, error } = await admin.auth.admin.createUser({ email: p.email, password: senha, email_confirm: true, user_metadata: { full_name: p.nome } });
  if (error) throw new Error(`${p.email}: ${error.message}`);
  const id = data.user.id;
  const { error: e2 } = await admin
    .from("profiles")
    .upsert({ id, email: p.email, full_name: p.nome, role: p.role, cpf: cpfLab(PERSONAS.indexOf(p) + 1), ...(p.gestor ? { account_type: "gestor" } : {}), ...(p.role === "admin" ? { recebe_alertas_operacionais: true } : {}) }, { onConflict: "id" });
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
  // E604: todo anúncio publicado tem comodidade (como em produção) — a t2051 abre o bloco "comodidades" de cada um.
  const { error: e3 } = await admin.from("property_amenities").insert({ property_id: data.id, category: "seguranca", label: "Extintor de incêndio", sort_order: 0 });
  if (e3) throw new Error(`comodidade ${i}: ${e3.message}`);
  await confirmarConforto(ownerId, data.id);
  return data.id;
}

/**
 * t2045 (E306): parceiro publicado (não é de teste: o visitante vê na /parceiros/buscar), com 3 fotos na galeria
 * (salvo `galeria: false`), uma capa própria se `capa` e uma foto de perfil se `avatar`. O bucket "parceiros" só aceita WEBP (migração 0190), como a página do parceiro grava.
 */
/** CNPJ válido e fixo por n (E648: parceiro só aparece na busca com CNPJ); mesmos dígitos do cnpjAleatorio das fixtures. */
function cnpjLab(n) {
  const base = String(10000000 + n).slice(-8).split("").map(Number).concat([0, 0, 0, 1]);
  const dv = (b) => {
    const pesos = b.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = b.reduce((s, d, i) => s + d * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base);
  return [...base, d1, dv([...base, d1])].join("");
}

async function criarParceiro(userId, { nome, slug, categoria, capa, galeria = true, avatar = false, n }) {
  const webp = async (cor) => sharp(png(640, 360, cor)).webp({ quality: 85 }).toBuffer();
  const subir = async (path, cor) => {
    const { error } = await admin.storage.from("parceiros").upload(path, await webp(cor), { contentType: "image/webp", upsert: true });
    if (error) throw new Error(`foto do parceiro ${slug}: ${error.message}`);
  };
  const bannerPath = capa ? `${userId}/capa.webp` : null;
  if (bannerPath) await subir(bannerPath, [90, 120, 160]);
  const avatarPath = avatar ? `${userId}/foto.webp` : null;
  if (avatarPath) await subir(avatarPath, [210, 170, 120]);
  const { data, error } = await admin
    .from("parceiros")
    .insert({
      user_id: userId, tipo_pessoa: "pj", documento: cnpjLab(n), nome_publico: nome, slug, categorias: [categoria],
      descricao_curta: `Parceiro do laboratório (${categoria}).`, cidades: ["Uberlândia"], status: "publicado",
      publicado_em: new Date().toISOString(), banner_path: bannerPath, avatar_path: avatarPath,
    })
    .select("id")
    .single();
  if (error) throw new Error(`parceiro ${slug}: ${error.message}`);
  if (!galeria) return data.id;
  const cores = [[200, 150, 120], [120, 180, 140], [160, 140, 200]];
  const linhas = cores.map((_, k) => ({ parceiro_id: data.id, path: `${userId}/galeria-${k}.webp`, legenda: `Trabalho ${k + 1}`, ordem: k }));
  for (const [k, l] of linhas.entries()) await subir(l.path, cores[k]);
  const { error: eG } = await admin.from("parceiro_galeria").insert(linhas);
  if (eG) throw new Error(`galeria ${slug}: ${eG.message}`);
  return data.id;
}

// Prompt 59: os 10 itens do padrão mínimo (src/config/conforto-minimo.ts; a lista é conferida em src/lib/conforto/regras.test.ts).
const CHAVES_CONFORTO = ["cama_colchao", "roupa_cama_banho", "agua_quente", "cozinha_basica", "ventilacao_quartos", "iluminacao", "fechadura_entrada", "entrega_limpa", "internet_informada", "mobilia_das_fotos", "lavanderia_acesso", "apoio_cama"];
async function confirmarConforto(ownerId, propertyId) {
  const agora = new Date().toISOString();
  const { error } = await admin
    .from("conforto_declaracoes")
    .upsert(CHAVES_CONFORTO.map((chave) => ({ property_id: propertyId, chave, confirmado: true, confirmado_por: ownerId, confirmado_em: agora, versao_lista: 2 })), { onConflict: "property_id,chave" });
  if (error) throw new Error(`padrão mínimo ${propertyId}: ${error.message}`);
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
  // t2050 (E579): dono PJ que declarou emitir nota, com 1 anúncio ativo — o chip "Emite nota fiscal" da /buscar conta 1.
  {
    const { error } = await admin.from("profiles").update({ person_type: "pj", emite_nota_locacao: true }).eq("id", ids.PROPRIETARIO_PJ_NOTA);
    if (error) throw new Error(`t2050 dono PJ: ${error.message}`);
    await criarImovel(ids.PROPRIETARIO_PJ_NOTA, 4, fotos);
    console.log("✓ t2050: Dora Nota (PJ, emite nota) com 1 anúncio ativo");
  }
  // t2045 (E306): dois parceiros publicados — Lia com capa própria e galeria; Gil sem capa, só galeria.
  await criarParceiro(ids.PARCEIRO_CAPA, { nome: "Lia Capa Fotografia", slug: "lab-lia-capa", categoria: "fotografia", capa: true, n: 41 });
  await criarParceiro(ids.PARCEIRO_GALERIA, { nome: "Gil Galeria Limpeza", slug: "lab-gil-galeria", categoria: "limpeza", capa: false, n: 42 });
  await criarParceiro(ids.PARCEIRO_FOTO, { nome: "Caio Foto Manutenção", slug: "lab-caio-foto", categoria: "manutencao", capa: false, galeria: false, avatar: true, n: 43 });
  console.log("✓ t2045: parceiros publicados (A lab-gil-galeria só galeria; B lab-lia-capa com capa; C lab-caio-foto só foto de perfil)");
  // E604 (Gerente, 16/11): o caso duplicado para a t2051 — o imóvel 1 tem "TV" nas comodidades E o extra LEGADO "tv"
  // salvo (anúncio antigo), com nível calculado para o bloco "Extras" aparecer. A ficha mostra TV só nas comodidades.
  {
    const { error: eCom } = await admin.from("property_amenities").insert({ property_id: imovel1, category: "conforto", label: "TV", sort_order: 1 });
    if (eCom) throw new Error(`E604 comodidade: ${eCom.message}`);
    const { error: eNiv } = await admin.from("imovel_nivel").upsert({ property_id: imovel1, nivel: "essencial" }, { onConflict: "property_id" });
    if (eNiv) throw new Error(`E604 nível: ${eNiv.message}`);
    const { error: eExt } = await admin.from("imovel_extras").insert([{ property_id: imovel1, chave: "tv" }, { property_id: imovel1, chave: "air_fryer" }]);
    if (eExt) throw new Error(`E604 extras: ${eExt.message}`);
    console.log("✓ E604: imóvel 1 com TV nas comodidades e o extra legado 'tv'");
  }
  // t2049 e t2051 (ORDEM-DUET-112): massa de teste marcada para os dois testes órfãos que pulavam por falta de dado no
  // laboratório (sonda 44323854417). Os dois anúncios são do Paulo Profissional (persona de teste) e dizem no título que
  // são massa; o resto é igual aos outros anúncios semeados.
  {
    // t2049 (E522): um anúncio que aceita caução — o chip "Caução" da /buscar conta 1 e filtra (antes: 0, chip desabilitado).
    await criarImovel(ids.PROPRIETARIO_PRO, 5, fotos, { title: "Imóvel mobiliado de teste 5 — laboratório (massa t2049: aceita caução)", garantias_aceitas: ["caucao_avista"] });
    // t2051 (E604): um anúncio com nível calculado e um extra que NÃO é comodidade (Air fryer), para o bloco "Extras"
    // aparecer. A t2051 abre só os 6 primeiros da /buscar, e a relevância desempata pelo id (E810, ids sorteados): o id é
    // fixo e o menor possível, para este anúncio ser sempre um dos 6.
    const extras = await criarImovel(ids.PROPRIETARIO_PRO, 6, fotos, { id: "00000000-0000-4000-8000-000000002051", title: "Imóvel mobiliado de teste 6 — laboratório (massa t2051: extra fora das comodidades)" });
    const { error: eNiv } = await admin.from("imovel_nivel").upsert({ property_id: extras, nivel: "essencial" }, { onConflict: "property_id" });
    if (eNiv) throw new Error(`t2051 nível: ${eNiv.message}`);
    const { error: eExt } = await admin.from("imovel_extras").insert({ property_id: extras, chave: "air_fryer" });
    if (eExt) throw new Error(`t2051 extra: ${eExt.message}`);
    console.log("✓ t2049/t2051: massa marcada — 1 anúncio que aceita caução e 1 com extra fora das comodidades (id fixo, 1.º da relevância)");
  }
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

  // 2FA da admin de teste (portão AAL2 do /admin, #422): cria e verifica o fator TOTP e guarda o
  // segredo para a suíte E2E (TESTES_ADMIN_TOTP_SEGREDO). Sem a chave anon (uso local avulso), pula.
  let segredoTotpAdmin = "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (anon) {
    const roberta = PERSONAS.find((p) => p.chave === "ADMIN");
    const cliente = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    segredoTotpAdmin = await ativarTotp(cliente, roberta.email, senha);
    console.log("✓ 2FA (TOTP) da admin de teste ativado");
  }

  // Saídas: env para a suíte E2E (sem imprimir a senha) + lista de contas sem senha.
  const ge = process.env.GITHUB_ENV;
  if (ge) {
    for (const p of PERSONAS) {
      appendFileSync(ge, `TESTES_${p.chave}_EMAIL=${p.email}\nTESTES_${p.chave}_SENHA=${senha}\nTESTES_${p.chave}_NOME=${p.nome}\n`);
    }
    appendFileSync(ge, `TESTES_CONFERIR_CODIGO=${codigoConferir}\n`);
    if (segredoTotpAdmin) {
      console.log(`::add-mask::${segredoTotpAdmin}`);
      appendFileSync(ge, `TESTES_ADMIN_TOTP_SEGREDO=${segredoTotpAdmin}\n`);
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
