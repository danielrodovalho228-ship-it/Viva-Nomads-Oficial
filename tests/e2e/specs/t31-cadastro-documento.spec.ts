import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

/**
 * T31 — CADASTRO CONFIÁVEL (laboratório): CPF/CNPJ antes de aceitar, assinar e fechar.
 * Usa contas NOVAS criadas aqui (dono e inquilina sem documento), para não mexer
 * nas personas que os outros specs usam em paralelo.
 *  1. Dono sem CPF: aprovar candidatura é recusado com a mensagem e o link
 *     "Informar meu documento"; a candidatura continua "new".
 *  2. Assinar plano sem CPF: 400 com a mensagem.
 *  3. Conta → Documento: CPF inválido recusado; CPF de outra conta recusado;
 *     CPF válido salvo e mostrado só MASCARADO (o número inteiro não vai à tela).
 *  4. Com o CPF, o aceite passa; o fechamento avisa que falta o CPF do inquilino.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });

const CPF_DONO = "529.982.247-25"; // válido (exemplo clássico de CPF de teste)
const CPF_INVALIDO = "529.982.247-26";

const senha = randomBytes(12).toString("hex");
const sufixo = randomBytes(3).toString("hex");
const dono = { email: `dono.doc.${sufixo}@lab.vivanomads.test`, nome: "Dora Documento", role: "owner" };
const inquilina = { email: `inq.doc.${sufixo}@lab.vivanomads.test`, nome: "Iara Documento", role: "tenant" };
const ids: { dono?: string; inquilina?: string; imovel?: string; lead?: string } = {};

async function criarConta(p: { email: string; nome: string; role: string }): Promise<string> {
  const { data, error } = await adm().auth.admin.createUser({ email: p.email, password: senha, email_confirm: true, user_metadata: { full_name: p.nome } });
  if (error) throw error;
  const id = data.user.id;
  const { error: e2 } = await adm().from("profiles").upsert({ id, email: p.email, full_name: p.nome, role: p.role, cpf: null }, { onConflict: "id" });
  if (e2) throw e2;
  return id;
}

async function entrar(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.locator('input[name="email"], input[type="email"]').first().fill(email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return page;
}

const statusLead = async () => ((await adm().from("leads").select("status").eq("id", ids.lead!).single()).data?.status as string) ?? "";

test.describe("T31 — Cadastro confiável: documento da pessoa", () => {
  test.skip(process.env.INTEGRACOES_SIMULADAS !== "on" || !URL || !SERVICE, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono);
    ids.inquilina = await criarConta(inquilina);
    const { data: imovel, error } = await adm()
      .from("properties")
      .insert({
        owner_id: ids.dono,
        title: "Studio do teste de documento — laboratório",
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
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.imovel = imovel.id as string;
    const { data: lead, error: e2 } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inquilina, property_id: ids.imovel, status: "new" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.lead = lead.id as string;
  });

  test.afterAll(async () => {
    for (const id of [ids.dono, ids.inquilina]) if (id) await adm().auth.admin.deleteUser(id);
  });

  test("dono sem CPF: aceite e assinatura recusados; Conta → Documento valida, salva e mascara; depois o aceite passa", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email);

    // 1) Aprovar sem documento → recusado, com o caminho para resolver.
    await page.goto("/dashboard/leads", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Aprovar e responder/i }).first().click();
    const aviso = page.getByTestId("aceite-erro");
    await expect(aviso).toContainText("Antes de aceitar uma candidatura, informe seu CPF", { timeout: 15_000 });
    await expect(aviso).toContainText("Conta → Documento");
    expect(await statusLead()).toBe("new");
    await page.screenshot({ path: "tests/laboratorio/saida/t31-1-aceite-sem-documento.png", fullPage: true });

    // 2) Assinar plano sem documento → 400 com a mensagem.
    const res = await page.request.post("/api/assinatura", { data: { planId: "essential", billingType: "PIX" } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("Antes de assinar o plano, informe seu CPF");

    // 3) Conta → Documento.
    await aviso.getByRole("link", { name: "Informar meu documento" }).click();
    await page.waitForURL(/\/dashboard\/conta#documento/);
    const secao = page.locator("#documento");
    await expect(secao).toBeVisible({ timeout: 15_000 });
    await secao.getByLabel("CPF").fill(CPF_INVALIDO);
    await secao.getByRole("button", { name: "Salvar documento" }).click();
    await expect(secao).toContainText("CPF inválido", { timeout: 15_000 });

    // CPF que já é de outra conta (uma persona do laboratório) → recusado.
    const { data: outro } = await adm().from("profiles").select("cpf").not("cpf", "is", null).neq("id", ids.dono!).limit(1).single();
    await secao.getByLabel("CPF").fill(outro!.cpf as string);
    await secao.getByRole("button", { name: "Salvar documento" }).click();
    await expect(secao).toContainText("já está cadastrado em outra conta", { timeout: 15_000 });

    await secao.getByLabel("CPF").fill(CPF_DONO);
    await secao.getByRole("button", { name: "Salvar documento" }).click();
    await expect(page.getByTestId("documento-cadastrado")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("documento-cadastrado").getByLabel("CPF")).toHaveValue("***.982.247-**");
    expect((await adm().from("profiles").select("cpf").eq("id", ids.dono!).single()).data!.cpf).toBe("52998224725");
    await page.screenshot({ path: "tests/laboratorio/saida/t31-2-documento-mascarado.png", fullPage: true });

    // Depois de recarregar: continua mascarado e o número inteiro não está no HTML.
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("documento-cadastrado")).toBeVisible({ timeout: 15_000 });
    expect(await page.content()).not.toContain("52998224725");
    expect(await page.content()).not.toContain("529.982.247-25");

    // 4) Agora o aceite passa.
    await page.goto("/dashboard/leads", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Aprovar e responder/i }).first().click();
    await expect.poll(statusLead, { timeout: 15_000 }).toBe("accepted");
    await expect(page.getByTestId("aceite-erro")).toHaveCount(0);

    // 5) Fechamento: falta o CPF da inquilina → aviso claro (o contrato precisa das duas partes).
    await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("documento-pendente")).toContainText("O inquilino ainda não informou o CPF", { timeout: 15_000 });
    await page.screenshot({ path: "tests/laboratorio/saida/t31-3-fechamento-falta-inquilino.png", fullPage: true });
    await page.context().close();
  });

  test("a pessoa não troca o CPF direto no banco (só pelo servidor)", async () => {
    const { createClient: cc } = await import("@supabase/supabase-js");
    const anon = cc(URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await anon.auth.signInWithPassword({ email: dono.email, password: senha });
    expect(error).toBeNull();
    const { error: e1 } = await anon.from("profiles").update({ cpf: "11144477735" }).eq("id", ids.dono!);
    expect(e1).not.toBeNull();
    const { error: e2 } = await anon.from("profiles").update({ company_name: "Outra Empresa" }).eq("id", ids.dono!);
    expect(e2).not.toBeNull();
    expect((await adm().from("profiles").select("cpf").eq("id", ids.dono!).single()).data!.cpf).toBe("52998224725");
  });
});
