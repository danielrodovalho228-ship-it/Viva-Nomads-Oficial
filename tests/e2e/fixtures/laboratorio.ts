import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import { expect, type Browser, type Page } from "@playwright/test";
import { CHAVES_CONFORTO, VERSAO_CONFORTO } from "../../../src/config/conforto-minimo";

/**
 * Apoio dos specs do LABORATÓRIO (t34–t37): contas NOVAS por spec (não mexem nas
 * personas dos outros specs, que rodam em paralelo), imóveis prontos para publicar
 * e fotos geradas aqui mesmo (nenhum crédito gasto, nada baixado da internet).
 * Tudo isto só roda contra o Supabase LOCAL (`INTEGRACOES_SIMULADAS=on`).
 */
export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const CHAVE_SERVICO = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true só no laboratório (banco local + integrações simuladas). */
export const NO_LABORATORIO = process.env.INTEGRACOES_SIMULADAS === "on" && !!URL_SUPABASE && !!CHAVE_SERVICO;

export const adm = (): SupabaseClient => createClient(URL_SUPABASE!, CHAVE_SERVICO!, { auth: { persistSession: false } });

/**
 * Zera o limite de chamados (8 por hora por IP de visitante). No laboratório todos os visitantes saem do mesmo IP
 * e vários specs abrem chamado pelo chat: sem isto, os últimos recebem "Muitos chamados em pouco tempo".
 */
export async function liberarLimiteChamados(): Promise<void> {
  await adm().from("limites_uso").delete().like("chave", "chamado:%");
}

/**
 * Zera o limite diário de pedidos de moradia (3 por conta por dia). As contas fixas do laboratório publicam
 * pedidos em vários specs (e nas repetições); sem isto o último recebe "Você já publicou 3 pedidos hoje".
 */
export async function liberarLimitePedidos(): Promise<void> {
  await adm().from("limites_uso").delete().like("chave", "pedido:%");
}

/**
 * Deixa e-mail e telefone da conta confirmados, como o pedido de moradia exige para chegar aos proprietários
 * (migração 0160: auth.users + public.telefone_verificacao). Só no laboratório; idempotente.
 */
export async function confirmarContatoDaConta(email: string): Promise<void> {
  const { data: perfil, error } = await adm().from("profiles").select("id").eq("email", email).maybeSingle();
  if (error || !perfil) throw new Error(`conta do laboratório não encontrada: ${email}`);
  const id = perfil.id as string;
  const { error: e1 } = await adm().auth.admin.updateUserById(id, { email_confirm: true, phone: "5562999991234", phone_confirm: true });
  if (e1) throw e1;
  const { error: e2 } = await adm()
    .from("telefone_verificacao")
    .upsert({ user_id: id, verificado_em: new Date().toISOString() }, { onConflict: "user_id" });
  if (e2) throw e2;
}

export const novaSenha = (): string => randomBytes(12).toString("hex");
// Só letras (a–p, o hex com os dígitos trocados): sufixo só de dígitos somava com o número do título ("Studio Fila
// 1280 482913" = 10 dígitos) e a regra de contato do banco (0057, 23514) recusava a massa como telefone (L-32, t237).
export const novoSufixo = (): string => randomBytes(3).toString("hex").replace(/\d/g, (d) => "ghijklmnop"[Number(d)]);

/** CPF válido aleatório (dígitos verificadores certos). */
export function cpfAleatorio(): string {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (b: number[]) => {
    const r = (b.reduce((s, x, i) => s + x * (b.length + 1 - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(d));
  d.push(dv(d));
  return d.join("");
}

/** PDF mínimo válido (assinatura %PDF) acima do tamanho mínimo aceito (10 KB). */
export const pdf = (): Buffer => Buffer.concat([Buffer.from("%PDF-1.4\n% laboratório\n"), Buffer.alloc(12 * 1024, 0x20), Buffer.from("\n%%EOF\n")]);

// ── Fotos de teste geradas localmente (PNG de cor sólida com faixas) ─────────
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function bloco(tipo: string, dados: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** PNG real e legível (640×480 por padrão). `n` muda a cor: cada foto é diferente. */
export function pngDeTeste(n: number, w = 640, h = 480): Buffer {
  const cor = [(60 + n * 23) % 220, (90 + n * 41) % 220, (120 + n * 67) % 220];
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    const faixa = Math.floor(y / (h / 6)) % 2 ? 0.85 : 1;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = cor[0] * faixa;
      raw[o + 1] = cor[1] * faixa;
      raw[o + 2] = cor[2] * faixa;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco("IHDR", ihdr), bloco("IDAT", deflateSync(raw)), bloco("IEND", Buffer.alloc(0))]);
}

export interface ContaLab {
  email: string;
  nome: string;
  role: "owner" | "tenant";
}

/** Cria a conta (Auth + perfil). `comCpf=false` deixa o CPF vazio (o spec preenche pela tela). */
/** Telefone válido nas contas do laboratório: publicar exige perfil de dono com nome e telefone (F45, updateProperty). */
export const TELEFONE_LAB = "(62) 99999-1234";

export async function criarConta(c: ContaLab, senha: string, comCpf = true): Promise<string> {
  const { data, error } = await adm().auth.admin.createUser({ email: c.email, password: senha, email_confirm: true, user_metadata: { full_name: c.nome } });
  if (error) throw error;
  const id = data.user.id;
  const { error: e2 } = await adm()
    .from("profiles")
    .upsert({ id, email: c.email, full_name: c.nome, phone: TELEFONE_LAB, role: c.role, cpf: comCpf ? cpfAleatorio() : null }, { onConflict: "id" });
  if (e2) throw e2;
  return id;
}

/** Plano pago valendo AGORA (o que o webhook de pagamento faria). */
export async function definirPlano(ownerId: string, plano: "essential" | "pro" | null): Promise<void> {
  await adm().from("subscriptions").delete().eq("owner_id", ownerId);
  if (!plano) return;
  const { error } = await adm().from("subscriptions").insert({ owner_id: ownerId, plan: plano, status: "active", gateway: "asaas" });
  if (error) throw error;
}

const BASE_PUBLICA = "/storage/v1/object/public/property-photos";

/**
 * Cria um imóvel completo para publicar: 8 fotos, descrição, garantia e
 * documento APROVADO. Fica como rascunho (ou ativo, se `ativo`).
 *
 * As fotos são PNGs gerados aqui e enviados ao Storage local. A linha em
 * `property_photos` usa o endereço https (a regra do editor só aceita https na
 * pasta do dono — o Supabase local é http): é o que deixa o botão Publicar do
 * editor funcionar no laboratório. Para a página pública mostrar a imagem de
 * verdade, use `fotosReais` depois de publicar.
 */
export async function criarImovelPronto(
  ownerId: string,
  titulo: string,
  opts: { ativo?: boolean; preco?: number; /** ordem f92bc582: sem a declaração "sem câmeras dentro" o anúncio não publica (padrão do laboratório: declarada) */ semDeclaracaoCameras?: boolean; /** documento ainda NA FILA do admin (titular = este nome) em vez de aprovado */ documentoPendente?: string; /** Prompt 59: sem o padrão mínimo de conforto confirmado (padrão do laboratório: os 10 itens confirmados) */ semConforto?: boolean; /** 61-B (#1155): sem o tipo de entrada, que passou a ser obrigatório para publicar anúncio novo (padrão do laboratório: "porteiro") */ semTipoEntrada?: boolean; /** FILTROS-1: sem a velocidade da internet (padrão: 300 Mbps) */ semInternet?: boolean } = {}
): Promise<string> {
  const { data, error } = await adm()
    .from("properties")
    .insert({
      owner_id: ownerId,
      title: titulo,
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
      monthly_price: opts.preco ?? 3200,
      garantias_aceitas: ["caucao"],
      status: "draft",
      sem_cameras_interior: !opts.semDeclaracaoCameras,
      tipo_entrada: opts.semTipoEntrada ? null : "porteiro",
      // FILTROS-1 (E39): publicar exige a velocidade da internet (padrão do laboratório: 300 Mbps informados).
      internet_mbps: opts.semInternet ? null : 300,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  for (let i = 0; i < 8; i++) {
    const caminho = `${ownerId}/${id}-${i}.png`;
    const { error: eUp } = await adm().storage.from("property-photos").upload(caminho, pngDeTeste(i), { contentType: "image/png", upsert: true });
    if (eUp) throw eUp;
  }
  await gravarFotos(id, ownerId, false);
  if (opts.documentoPendente) {
    // Arquivo no bucket privado + linha "em análise" (como o envio da tela deixa).
    const caminhoDoc = `${ownerId}/${randomBytes(6).toString("hex")}.png`;
    const arquivo = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(11 * 1024)]);
    const { error: eUpDoc } = await adm().storage.from("property-docs").upload(caminhoDoc, arquivo, { contentType: "image/png" });
    if (eUpDoc) throw eUpDoc;
    const { error: ePend } = await adm().from("qualification_checklists").insert({
      owner_id: ownerId,
      property_id: id,
      document_path: caminhoDoc,
      document_status: "pending",
      document_hash_sha256: randomBytes(32).toString("hex"),
      document_uploaded_at: new Date().toISOString(),
      formulario: { versao: 1, elig: { titularDocumento: opts.documentoPendente } },
    });
    if (ePend) throw ePend;
  } else {
    const { error: eDoc } = await adm()
      .from("qualification_checklists")
      .insert({ owner_id: ownerId, property_id: id, document_status: "approved", document_reviewed_at: new Date().toISOString() });
    if (eDoc) throw eDoc;
  }
  if (!opts.semConforto) {
    // Prompt 59: publicar exige os 10 itens do padrão mínimo confirmados pelo dono (o que a tela grava).
    const { error: eConf } = await adm()
      .from("conforto_declaracoes")
      .upsert(CHAVES_CONFORTO.map((chave) => ({ property_id: id, chave, confirmado: true, confirmado_por: ownerId, confirmado_em: new Date().toISOString(), versao_lista: VERSAO_CONFORTO })), { onConflict: "property_id,chave" });
    if (eConf) throw eConf;
  }
  if (opts.ativo) {
    const { error: eAtivo } = await adm().from("properties").update({ status: "active" }).eq("id", id);
    if (eAtivo) throw eAtivo;
  }
  return id;
}

async function gravarFotos(propertyId: string, ownerId: string, reais: boolean): Promise<void> {
  await adm().from("property_photos").delete().eq("property_id", propertyId);
  const linhas = Array.from({ length: 8 }, (_, i) => {
    const caminho = `${ownerId}/${propertyId}-${i}.png`;
    const url = reais
      ? adm().storage.from("property-photos").getPublicUrl(caminho).data.publicUrl
      : `https://lab.vivanomads.test${BASE_PUBLICA}/${caminho}`;
    return { property_id: propertyId, url, sort_order: i };
  });
  const { error } = await adm().from("property_photos").insert(linhas);
  if (error) throw error;
}

/** Troca as fotos pelos endereços reais do Storage local (a página pública carrega a imagem). */
export const fotosReais = (propertyId: string, ownerId: string): Promise<void> => gravarFotos(propertyId, ownerId, true);

export async function statusDoImovel(id: string): Promise<string> {
  return ((await adm().from("properties").select("status").eq("id", id).single()).data?.status as string) ?? "";
}

export async function contarAtivos(ownerId: string): Promise<number> {
  const { count } = await adm().from("properties").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "active");
  return count ?? 0;
}

/**
 * Zera o contador de login POR IP (40 por 15 min). O laboratório inteiro sai do mesmo IP e passa disso
 * (lab b5fb67f6: t55 recebeu 429 em vez de 401 e t82 não entrou). Só o laboratório chama.
 */
export async function liberarLimiteLoginIp(): Promise<void> {
  await adm().from("limites_uso").delete().like("chave", "login:ip:%");
}

/**
 * Zera o atraso progressivo do login SÓ deste e-mail (5 por minuto, src/lib/seguranca/limite-login.ts). Os specs
 * entram com a mesma conta várias vezes em menos de um minuto (390 e 1280, um passo atrás do outro); sem isto o
 * login recebe "Muitas tentativas" e o teste para na tela de entrar.
 */
export async function liberarLimiteLogin(email: string): Promise<void> {
  const hash = createHash("sha256").update(`login:${email.trim().toLowerCase()}`).digest("hex").slice(0, 32);
  await adm().from("limites_uso").delete().like("chave", `login:email:%:${hash}`);
  // O limite por IP (40 a cada 15 min) também: no laboratório todos os logins saem do mesmo IP e uma rodada longa
  // (16 suítes) passa disso. O t82 não depende dele (aceita a mensagem de "Muitas tentativas" como prova do fluxo).
  await adm().from("limites_uso").delete().like("chave", "login:ip:%");
}

/**
 * Prompt 49: o envio do código tem teto de 5 por hora por e-mail e por IP. No laboratório todos os specs saem do mesmo
 * IP; antes de pedir código, os specs limpam as contagens de envio (só as do código).
 */
export async function liberarLimiteCodigo(): Promise<void> {
  await adm().from("limites_uso").delete().like("chave", "codigo:%");
}

/** Login pela tela, em contexto próprio de 390 px (celular). */
export async function entrar(browser: Browser, email: string, senha: string): Promise<Page> {
  await liberarLimiteLogin(email);
  await liberarLimiteLoginIp();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // networkidle sem teto pendurava até o fim do teste na 1ª carga fria (t168 a 390 px, lab 17/10): espera até 10 s e segue.
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  // Um clique antes da hidratação vira envio nativo e recarrega /auth vazio (t262, t82, t204 no lab de 23/10):
  // enquanto não sair de /auth, preenche o que estiver vazio e clica de novo.
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/\/dashboard/.test(new URL(page.url()).pathname)) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== email) await campoEmail.fill(email, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return page;
}

/** Abre o editor do imóvel e clica em Publicar (falha se o botão estiver travado). */
export async function publicarPeloEditor(page: Page, propertyId: string): Promise<void> {
  await page.goto(`/dashboard/imoveis/${propertyId}/editar`, { waitUntil: "domcontentloaded" });
  // O Publicar só habilita depois do aceite do termo de IA (editar-client.tsx): sem marcar, o clique esperava até estourar o tempo do teste.
  await page.getByTestId("aceite-ia").getByRole("checkbox").check({ timeout: 20_000 });
  const publicar = page.getByRole("button", { name: "Publicar", exact: true });
  await expect(publicar, "Publicar deveria estar habilitado: veja 'Falta para publicar' no editor").toBeEnabled({ timeout: 20_000 });
  await publicar.click();
}

export async function apagarContas(ids: (string | undefined)[]): Promise<void> {
  for (const id of ids) {
    if (!id) continue;
    // Imóveis antes da conta: a exclusão em cascata esbarra no gatilho de qualidade (ver seed-lab).
    await adm().from("properties").delete().eq("owner_id", id);
    await adm().auth.admin.deleteUser(id);
  }
}

// ── Apoio dos specs t41–t48 (laboratório autônomo, ordem 225d0648) ───────────

/** Conta admin de teste (perfil criado como dono e promovido: `role` é texto no laboratório). */
export async function criarAdmin(email: string, nome: string, senha: string): Promise<string> {
  const id = await criarConta({ email, nome, role: "owner" }, senha);
  const { error } = await adm().from("profiles").update({ role: "admin" }).eq("id", id);
  if (error) throw error;
  return id;
}

/** Candidatura (lead) do inquilino ao imóvel do dono; `aceita` = o que o aceite do dono grava. */
export async function criarLead(ownerId: string, tenantId: string, propertyId: string, aceita = false): Promise<string> {
  const { data, error } = await adm()
    .from("leads")
    .insert({ owner_id: ownerId, tenant_id: tenantId, property_id: propertyId, status: aceita ? "accepted" : "new" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Mensagem gravada direto no banco (o primeiro "oi" da conversa), com o id de conversa do servidor. */
export async function gravarMensagem(de: string, para: string, propertyId: string, texto: string, conversationId: string): Promise<void> {
  const { error } = await adm().from("messages").insert({ conversation_id: conversationId, sender_id: de, receiver_id: para, property_id: propertyId, body: texto });
  if (error) throw error;
}

/** Linhas do LAB_OUTBOX (o que "teria sido enviado"), já em objetos. Sem arquivo, lista vazia. */
export async function lerSaida(): Promise<Array<Record<string, unknown>>> {
  const arquivo = process.env.LAB_OUTBOX;
  if (!arquivo) return [];
  const { readFile } = await import("node:fs/promises");
  const txt = await readFile(arquivo, "utf8").catch(() => "");
  return txt
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as Record<string, unknown>;
      } catch {
        return {};
      }
    });
}

/**
 * Põe um contrato `ativo` em VIGÊNCIA de verdade (regra única de contrato-etapas):
 * as duas assinaturas e o 1º aluguel confirmado pelo inquilino. Sem isso, "ativo"
 * no banco ainda é "Aguardando assinatura" e a manutenção é recusada (F27).
 */
export async function tornarContratoVigente(contratoId: string, donoId: string, aluguel = 3200): Promise<void> {
  const agora = new Date().toISOString();
  const { error: e1 } = await adm().from("contratos").update({ assinado_proprietario_em: agora, assinado_inquilino_em: agora }).eq("id", contratoId);
  if (e1) throw e1;
  const hoje = new Date();
  const fim = new Date(hoje.getTime() + 59 * 86_400_000);
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  // O contrato gerado pela tela já pode ter o bloco 1 (aguardando assinatura): reaproveita e põe em vigência.
  const linhaBloco = { inicio: dia(hoje), fim: dia(fim), meses: 2, valor: aluguel * 2, caucao: aluguel, status: "ativo" };
  const { data: existente } = await adm().from("contrato_blocos").select("id").eq("contrato_id", contratoId).eq("numero_bloco", 1).maybeSingle();
  const { data: bloco, error: e2 } = existente
    ? await adm().from("contrato_blocos").update(linhaBloco).eq("id", existente.id).select("id").single()
    : await adm().from("contrato_blocos").insert({ contrato_id: contratoId, numero_bloco: 1, ...linhaBloco }).select("id").single();
  if (e2) throw e2;
  const { error: e3 } = await adm().from("pagamentos_bloco").insert({
    bloco_id: bloco.id,
    contrato_id: contratoId,
    tipo: "aluguel",
    valor: aluguel,
    data_pagamento: dia(hoje),
    marcado_por: donoId,
    confirmado_pelo_inquilino: true,
    confirmado_em: agora,
  });
  if (e3) throw e3;
}

/**
 * Um bloco do contrato ainda SEM pagamento de valor mensal (0182: um por bloco). Se todos já têm, cria o próximo
 * bloco, já aceito pelas duas partes (renovação, 0065), logo depois do último.
 */
export async function blocoSemValorMensal(contratoId: string): Promise<string> {
  const { data: blocos } = await adm().from("contrato_blocos").select("id, numero_bloco, fim, meses, valor, caucao").eq("contrato_id", contratoId).order("numero_bloco");
  const { data: pgs } = await adm().from("pagamentos_bloco").select("bloco_id").eq("contrato_id", contratoId).eq("tipo", "aluguel").is("anulado_em", null);
  const usados = new Set(((pgs ?? []) as { bloco_id: string | null }[]).map((p) => p.bloco_id));
  const lista = (blocos ?? []) as { id: string; numero_bloco: number; fim: string; meses: number; valor: number; caucao: number }[];
  const livre = lista.find((b) => !usados.has(b.id));
  if (livre) return livre.id;
  const ultimo = lista[lista.length - 1];
  const ini = new Date(`${ultimo.fim}T12:00:00Z`);
  ini.setUTCDate(ini.getUTCDate() + 1);
  const fim = new Date(ini);
  fim.setUTCDate(fim.getUTCDate() + 59);
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contrato_blocos")
    .insert({
      contrato_id: contratoId, numero_bloco: ultimo.numero_bloco + 1, inicio: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10),
      meses: ultimo.meses, valor: ultimo.valor, caucao: 0, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
