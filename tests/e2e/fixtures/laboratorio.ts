import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { Browser, Page } from "@playwright/test";

/**
 * Apoio dos specs do LABORATÓRIO (t34–t38): contas NOVAS por spec (não mexem nas
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

export const novaSenha = (): string => randomBytes(12).toString("hex");
export const novoSufixo = (): string => randomBytes(3).toString("hex");

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
export async function criarConta(c: ContaLab, senha: string, comCpf = true): Promise<string> {
  const { data, error } = await adm().auth.admin.createUser({ email: c.email, password: senha, email_confirm: true, user_metadata: { full_name: c.nome } });
  if (error) throw error;
  const id = data.user.id;
  const { error: e2 } = await adm()
    .from("profiles")
    .upsert({ id, email: c.email, full_name: c.nome, role: c.role, cpf: comCpf ? cpfAleatorio() : null }, { onConflict: "id" });
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
  opts: { ativo?: boolean; preco?: number; /** documento ainda NA FILA do admin (titular = este nome) em vez de aprovado */ documentoPendente?: string } = {}
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

/** Login pela tela, em contexto próprio de 390 px (celular). */
export async function entrar(browser: Browser, email: string, senha: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.locator('input[name="email"], input[type="email"]').first().fill(email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return page;
}

/** Abre o editor do imóvel e clica em Publicar (falha se o botão estiver travado). */
export async function publicarPeloEditor(page: Page, propertyId: string): Promise<void> {
  await page.goto(`/dashboard/imoveis/${propertyId}/editar`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
}

export async function apagarContas(ids: (string | undefined)[]): Promise<void> {
  for (const id of ids) {
    if (!id) continue;
    // Imóveis antes da conta: a exclusão em cascata esbarra no gatilho de qualidade (ver seed-lab).
    await adm().from("properties").delete().eq("owner_id", id);
    await adm().auth.admin.deleteUser(id);
  }
}
