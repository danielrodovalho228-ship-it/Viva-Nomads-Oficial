/*
  LABORATÓRIO — massa de dados da VARREDURA VISUAL (t249). Só Supabase LOCAL, só contas is_teste.
  Idempotente: apaga as contas @varredura.lab.vivanomads.test da rodada anterior e recria tudo.

  Cenários (um por defeito que a varredura vigia):
    • dono-17   — anúncio ATIVO com 17 fotos (galeria longa; D-V1 lazy-load, D-V3 matrícula) + rascunho com 1 foto (D-V4);
    • dono-0    — rascunho de cadastro com 0 fotos (D-V2: barra de fotos a 390 px);
    • inquilina — contrato completo: assinado pelos dois, caução, conferência de ENTRADA com fotos
                  (D-V6: capa de Minhas locações);
    • parceiro  — parceiro PUBLICADO com galeria;
    • tres      — conta com os 3 papéis (anunciante, inquilina de um contrato e parceira).
  Recibos de pagamento: não há tabela de recibos no esquema atual — ficam de fora (ver PR).

  Saída: GITHUB_ENV (quando existir) com TESTES_VARREDURA_<CHAVE>_EMAIL/_SENHA e tests/laboratorio/saida/varredura.json
  (ids, sem senha). Uso: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=… LAB_SENHA=… node scripts/lab/massa-varredura.mjs
*/
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { deflateSync } from "node:zlib";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const senha = process.env.LAB_SENHA ?? "";
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["127.0.0.1", "localhost"].includes(host)) {
  console.error(`✗ Recusando: a varredura só semeia o Supabase LOCAL. URL recebida: ${host || "(vazia)"}`);
  process.exit(1);
}
if (!chave || senha.length < 16) {
  console.error("✗ Faltou SUPABASE_SERVICE_ROLE_KEY ou LAB_SENHA (mínimo 16 caracteres).");
  process.exit(1);
}
const admin = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
const DOMINIO = "@varredura.lab.vivanomads.test";

export const CONTAS = [
  { chave: "DONO17", email: `dono17${DOMINIO}`, nome: "Dora Dezessete", role: "owner" },
  { chave: "DONO0", email: `dono0${DOMINIO}`, nome: "Davi Zero Fotos", role: "owner" },
  { chave: "INQUILINA", email: `inquilina${DOMINIO}`, nome: "Iara Locatária", role: "tenant" },
  { chave: "PARCEIRO", email: `parceiro${DOMINIO}`, nome: "Paulo Parceiro", role: "tenant" },
  { chave: "TRES", email: `tres${DOMINIO}`, nome: "Tereza Três Papéis", role: "owner" },
];

// PNG real (640×480, cor por índice): nenhum crédito gasto, nada baixado.
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
const bloco = (t, d) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(n, w = 640, h = 480) {
  const cor = [(60 + n * 23) % 220, (90 + n * 41) % 220, (120 + n * 67) % 220];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(cor, y * (w * 3 + 1) + 1 + x * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco("IHDR", ihdr), bloco("IDAT", deflateSync(raw)), bloco("IEND", Buffer.alloc(0))]);
}
async function enviar(bucket, caminho, n) {
  const { error } = await admin.storage.from(bucket).upload(caminho, png(n), { contentType: "image/png", upsert: true });
  if (error) throw new Error(`upload ${bucket}/${caminho}: ${error.message}`);
  return admin.storage.from(bucket).getPublicUrl(caminho).data.publicUrl;
}
const ok = (e, o) => {
  if (e) throw new Error(`${o}: ${e.message}`);
};

function cpf(n) {
  const d = String(410000000 + n * 7919).slice(0, 9).split("").map(Number);
  const dv = (b) => {
    const r = (b.reduce((s, x, i) => s + x * (b.length + 1 - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(d));
  d.push(dv(d));
  return d.join("");
}

async function limpar() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  ok(error, "listar usuários");
  for (const u of (data?.users ?? []).filter((x) => x.email?.endsWith(DOMINIO))) {
    await admin.from("chamados").delete().eq("usuario_id", u.id);
    const { data: ps } = await admin.from("parceiros").select("id").eq("user_id", u.id);
    for (const p of ps ?? []) await admin.from("parceiro_galeria").delete().eq("parceiro_id", p.id);
    await admin.from("parceiros").delete().eq("user_id", u.id);
    // Contratos em que a conta é inquilina (os do dono saem junto com os imóveis).
    await admin.from("contratos").delete().eq("tenant_id", u.id);
    ok((await admin.from("properties").delete().eq("owner_id", u.id)).error, `apagar imóveis de ${u.email}`);
    const { error: e } = await admin.auth.admin.deleteUser(u.id);
    ok(e, `apagar ${u.email}`);
  }
}

async function criarConta(c, i) {
  const { data, error } = await admin.auth.admin.createUser({ email: c.email, password: senha, email_confirm: true, user_metadata: { full_name: c.nome } });
  ok(error, c.email);
  const id = data.user.id;
  ok(
    (await admin.from("profiles").upsert({ id, email: c.email, full_name: c.nome, role: c.role, cpf: cpf(i + 1), phone: "(62) 99999-1234", is_teste: true }, { onConflict: "id" })).error,
    `perfil ${c.email}`,
  );
  return id;
}

async function criarImovel(owner, titulo, status, qtdFotos, extra = {}) {
  const { data, error } = await admin
    .from("properties")
    .insert({
      owner_id: owner,
      title: titulo,
      description: "Imóvel mobiliado de teste da varredura visual: home office, internet e cozinha completa.",
      property_type: "Apartamento",
      address: "Santa Mônica",
      city: "Uberlândia",
      state: "MG",
      bedrooms: 1,
      bathrooms: 1,
      area_m2: 42,
      max_guests: 2,
      min_period_days: 30,
      max_period_days: 180,
      monthly_price: status === "draft" ? 0 : 3200,
      status,
      ...extra,
    })
    .select("id")
    .single();
  ok(error, `imóvel ${titulo}`);
  if (qtdFotos > 0) {
    const urls = [];
    for (let k = 0; k < qtdFotos; k++) urls.push(await enviar("property-photos", `varredura/${data.id}/${k}.png`, k));
    ok((await admin.from("property_photos").insert(urls.map((u, k) => ({ property_id: data.id, url: u, sort_order: k })))).error, `fotos ${titulo}`);
    await admin.from("properties").update({ photo_count: qtdFotos }).eq("id", data.id);
  }
  // Prompt 59: padrão mínimo confirmado (a varredura visual não muda; a lista é conferida em src/lib/conforto/regras.test.ts).
  const agora = new Date().toISOString();
  ok(
    (await admin.from("conforto_declaracoes").upsert(CHAVES_CONFORTO.map((chave) => ({ property_id: data.id, chave, confirmado: true, confirmado_por: owner, confirmado_em: agora, versao_lista: 1 })), { onConflict: "property_id,chave" })).error,
    `padrão mínimo ${titulo}`,
  );
  return data.id;
}

const CHAVES_CONFORTO = ["cama_colchao", "roupa_cama_banho", "agua_quente", "cozinha_basica", "ventilacao_quartos", "iluminacao", "fechadura_entrada", "entrega_limpa", "internet_informada", "mobilia_das_fotos"];

/** Contrato completo: assinado pelos dois, caução, bloco ativo e conferência de ENTRADA confirmada com fotos. */
async function criarContratoCompleto(propertyId, ownerId, tenantId) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const inicio = new Date(Date.now() - 10 * 86400000);
  const agora = new Date().toISOString();
  const { data, error } = await admin
    .from("contratos")
    .insert({
      property_id: propertyId, tenant_id: tenantId, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200,
      tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
      assinado_proprietario_em: agora, assinado_inquilino_em: agora,
    })
    .select("id")
    .single();
  ok(error, "contrato");
  ok(
    (await admin.from("contrato_blocos").insert({
      contrato_id: data.id, numero_bloco: 1, inicio: iso(inicio), fim: iso(new Date(inicio.getTime() + 59 * 86400000)), meses: 2, valor: 6400, caucao: 3200, status: "ativo",
    })).error,
    "bloco do contrato",
  );
  const hash = createHash("sha256").update(`varredura:${data.id}`).digest("hex");
  ok(
    (await admin.from("contrato_assinaturas").insert([
      { contrato_id: data.id, user_id: ownerId, papel: "proprietario", hash_documento: hash },
      { contrato_id: data.id, user_id: tenantId, papel: "inquilino", hash_documento: hash },
    ])).error,
    "assinaturas",
  );
  const { data: conf, error: eConf } = await admin.from("conferencias").insert({ contrato_id: data.id, tipo: "entrada", aberta_por: tenantId }).select("id").single();
  ok(eConf, "conferência de entrada");
  for (const [k, comodo] of ["Sala", "Quarto", "Cozinha"].entries()) {
    const caminho = `${conf.id}/varredura-${k}.png`;
    const { error: eUp } = await admin.storage.from("conferencia").upload(caminho, png(k), { contentType: "image/png", upsert: true });
    ok(eUp, "foto da conferência");
    ok(
      (await admin.from("conferencia_itens").insert({ conferencia_id: conf.id, autor_id: tenantId, parte: "inquilino", comodo, descricao: `${comodo} conferida na entrada.`, foto_path: caminho })).error,
      "item da conferência",
    );
  }
  return data.id;
}

async function criarParceiro(userId) {
  const { data, error } = await admin
    .from("parceiros")
    .insert({
      user_id: userId, tipo_pessoa: "pf", documento: cpf(40), nome_publico: "Foto Varredura", slug: `foto-varredura-${randomBytes(2).toString("hex")}`,
      categorias: ["fotografia"], descricao_curta: "Fotografia de imóveis (teste da varredura).", cidades: ["Uberlândia"], status: "publicado", publicado_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  ok(error, "parceiro");
  const linhas = [];
  for (let k = 0; k < 6; k++) linhas.push({ parceiro_id: data.id, path: `${userId}/varredura-${k}.webp`, legenda: `Foto ${k + 1}`, ordem: k });
  for (const l of linhas) {
    // O bucket "parceiros" só aceita WEBP (migração 0190), como a página do parceiro grava.
    const webp = await sharp(png(l.ordem)).webp({ quality: 90 }).toBuffer();
    const { error: eUp } = await admin.storage.from("parceiros").upload(l.path, webp, { contentType: "image/webp", upsert: true });
    ok(eUp, "foto da galeria do parceiro");
  }
  ok((await admin.from("parceiro_galeria").insert(linhas)).error, "galeria do parceiro");
  return data.id;
}

async function main() {
  await limpar();
  const ids = {};
  for (const [i, c] of CONTAS.entries()) ids[c.chave] = await criarConta(c, i);

  const imovel17 = await criarImovel(ids.DONO17, "[Varredura] Anúncio com 17 fotos", "active", 17, { ready_to_live_badge: true });
  const rascunho1 = await criarImovel(ids.DONO17, "[Varredura] Rascunho com 1 foto", "draft", 1);
  const rascunho0 = await criarImovel(ids.DONO0, "[Varredura] Rascunho sem fotos", "draft", 0);
  const imovelTres = await criarImovel(ids.TRES, "[Varredura] Anúncio da conta três papéis", "active", 8);
  const contrato = await criarContratoCompleto(imovel17, ids.DONO17, ids.INQUILINA);
  // A conta dos 3 papéis também é inquilina (de outro anúncio do DONO17: um contrato ativo por imóvel) e parceira.
  const imovelDeOutro = await criarImovel(ids.DONO17, "[Varredura] Segundo anúncio do dono", "active", 8);
  const contratoTres = await criarContratoCompleto(imovelDeOutro, ids.DONO17, ids.TRES);
  const parceiro = await criarParceiro(ids.PARCEIRO);
  const parceiroTres = await criarParceiro(ids.TRES);

  const saida = { ids, imovel17, rascunho1, rascunho0, imovelTres, contrato, contratoTres, parceiro, parceiroTres };
  mkdirSync("tests/laboratorio/saida", { recursive: true });
  writeFileSync("tests/laboratorio/saida/varredura.json", JSON.stringify(saida, null, 2));
  if (process.env.GITHUB_ENV) {
    for (const c of CONTAS) appendFileSync(process.env.GITHUB_ENV, `TESTES_VARREDURA_${c.chave}_EMAIL=${c.email}\nTESTES_VARREDURA_${c.chave}_SENHA=${senha}\n`);
  }
  console.log(`✓ massa da varredura: ${CONTAS.length} contas is_teste, 4 imóveis, 2 contratos, 2 parceiros`);
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
