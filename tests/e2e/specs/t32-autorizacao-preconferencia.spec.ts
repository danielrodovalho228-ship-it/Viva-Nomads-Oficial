import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { authFile } from "../fixtures/auth";

/**
 * T32 — CADASTRO CONFIÁVEL, parte B (laboratório): quem opera o imóvel + pré-conferência.
 * Conta NOVA de dono (não mexe nas personas dos outros specs).
 *  1. "Administro para o proprietário": sem declaração e sem o contrato/procuração
 *     não avança; com o PDF anexado (pelo servidor), avança.
 *  2. O banco recusa publicar imóvel administrado sem o documento (0091).
 *  3. /admin/documentos: "Parece OK" para o imóvel próprio com titular = conta;
 *     "Atenção: …" para o administrado sem procuração. Quem aprova é o admin.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });

const senha = randomBytes(12).toString("hex");
const sufixo = randomBytes(3).toString("hex");
const dono = { email: `dono.op.${sufixo}@lab.vivanomads.test`, nome: "Olga Operacao" };
const titulos = { proprio: `Studio próprio T32 ${sufixo}`, administrado: `Apto administrado T32 ${sufixo}` };
const ids: { dono?: string; proprio?: string; administrado?: string } = {};

/** CPF válido aleatório (dígitos certos) — não colide com as personas nem com o T31. */
function cpfAleatorio(): string {
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
const pdf = () => Buffer.concat([Buffer.from("%PDF-1.4\n% laboratório\n"), Buffer.alloc(12 * 1024, 0x20), Buffer.from("\n%%EOF\n")]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(11 * 1024)]);

async function imovel(titulo: string, extra: Record<string, unknown>): Promise<string> {
  const { data, error } = await adm()
    .from("properties")
    .insert({
      owner_id: ids.dono, title: titulo, description: "Imóvel de teste do laboratório (T32).", property_type: "Studio",
      address: "Centro", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 30,
      min_period_days: 30, max_period_days: 180, monthly_price: 2500, status: "draft", ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function documentoPendente(propertyId: string, titular: string) {
  const caminho = `${ids.dono}/${randomBytes(6).toString("hex")}.png`;
  const { error: e1 } = await adm().storage.from("property-docs").upload(caminho, png(), { contentType: "image/png" });
  if (e1) throw e1;
  const { error } = await adm().from("qualification_checklists").insert({
    owner_id: ids.dono, property_id: propertyId, document_path: caminho, document_status: "pending",
    document_hash_sha256: randomBytes(32).toString("hex"), document_uploaded_at: new Date().toISOString(),
    formulario: { versao: 1, elig: { titularDocumento: titular } },
  });
  if (error) throw error;
}

async function entrar(browser: Browser, email: string): Promise<Page> {
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

test.describe("T32 — Autorização obrigatória e pré-conferência", () => {
  test.skip(process.env.INTEGRACOES_SIMULADAS !== "on" || !URL || !SERVICE, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const { data, error } = await adm().auth.admin.createUser({ email: dono.email, password: senha, email_confirm: true, user_metadata: { full_name: dono.nome } });
    if (error) throw error;
    ids.dono = data.user.id;
    const { error: e2 } = await adm().from("profiles").upsert({ id: ids.dono, email: dono.email, full_name: dono.nome, role: "owner", cpf: cpfAleatorio() }, { onConflict: "id" });
    if (e2) throw e2;
    ids.proprio = await imovel(titulos.proprio, { ownership_type: "own", sublease_authorized: true });
    ids.administrado = await imovel(titulos.administrado, { ownership_type: "managed", sublease_authorized: true });
    await documentoPendente(ids.proprio, dono.nome);
    await documentoPendente(ids.administrado, "Carlos Proprietário");
  });

  test.afterAll(async () => {
    if (ids.dono) await adm().auth.admin.deleteUser(ids.dono);
  });

  test("Administro para o proprietário: sem declaração e sem procuração não avança; com o PDF, avança", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email);
    // Qualificação aprovada (o portão do "Novo anúncio" lê esta marca da sessão).
    await page.evaluate(() => sessionStorage.setItem("vivanomads-qualification", JSON.stringify({ eligible: true, score: 80 })));
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "networkidle" });
    const outro = page.getByRole("button", { name: "Começar outro" });
    if (await outro.isVisible().catch(() => false)) await outro.click();

    await page.getByRole("radio", { name: "Administro para o proprietário" }).click();
    const secao = page.getByTestId("documento-operacao");
    await expect(secao).toContainText("contrato de administração ou a procuração");
    const continuar = page.getByRole("button", { name: "Continuar", exact: true });

    await continuar.click();
    await expect(secao).toContainText("Marque a declaração para continuar.");
    await secao.getByText("Administro este imóvel em nome do proprietário (gestor ou procurador)").click();
    await continuar.click();
    await expect(secao).toContainText("Anexe: contrato de administração ou procuração.");

    await secao.locator('input[type="file"]').setInputFiles({ name: "procuracao.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(secao.getByTestId("documento-anexado")).toContainText("procuracao.pdf", { timeout: 20_000 });
    await expect(secao.getByTestId("documento-anexado")).not.toContainText("só pré-visualização");
    await expect(secao).not.toContainText("Anexe: contrato de administração ou procuração.");
    await page.screenshot({ path: "tests/laboratorio/saida/t32-1-administro-com-procuracao.png", fullPage: true });

    await continuar.click();
    await expect(page.getByPlaceholder("Rua, número")).toBeVisible({ timeout: 10_000 });
    // O arquivo foi para a pasta do próprio dono no bucket privado.
    const { data: lista } = await adm().storage.from("property-docs").list(ids.dono!);
    expect((lista ?? []).some((f) => f.name.endsWith(".pdf"))).toBe(true);
    await page.context().close();
  });

  test("o banco recusa publicar imóvel administrado sem o documento", async () => {
    const cli = createClient(URL!, ANON!, { auth: { persistSession: false } });
    expect((await cli.auth.signInWithPassword({ email: dono.email, password: senha })).error).toBeNull();
    const { error } = await cli.from("properties").update({ status: "active" }).eq("id", ids.administrado!);
    expect(error?.message ?? "").toMatch(/autorização do proprietário \(ou a procuração\)/);
  });

  test("admin: 'Parece OK' no próprio; 'Atenção' no administrado sem procuração", async ({ browser }) => {
    test.setTimeout(60_000);
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/admin/documentos", { waitUntil: "networkidle" });

    const ok = page.locator(`[data-testid="doc-card"][data-imovel="${titulos.proprio}"]`);
    await expect(ok.getByTestId("pre-conferencia-veredito")).toHaveText("Parece OK", { timeout: 15_000 });
    await expect(ok.getByTestId("pre-conferencia")).toContainText("Só uma ajuda. Quem aprova ou recusa é você.");

    const atencao = page.locator(`[data-testid="doc-card"][data-imovel="${titulos.administrado}"]`);
    await expect(atencao.getByTestId("pre-conferencia-veredito")).toContainText("Atenção:");
    await expect(atencao.getByTestId("pre-conferencia-veredito")).toContainText("contrato de administração ou procuração não anexada");
    await atencao.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "tests/laboratorio/saida/t32-2-admin-preconferencia.png", fullPage: true });

    // Nada foi aprovado sozinho: os dois continuam pendentes.
    const { data } = await adm().from("qualification_checklists").select("document_status").eq("owner_id", ids.dono!);
    expect((data ?? []).every((d) => d.document_status === "pending")).toBe(true);
    await ctx.close();
  });
});
