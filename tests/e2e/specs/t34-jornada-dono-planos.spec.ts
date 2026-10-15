import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

/**
 * T34 — JORNADA DO DONO: vários imóveis e troca de plano (laboratório). Conta NOVA.
 * O caminho que o Daniel relatou ("coloco um imóvel e tento um plano mais avançado,
 * não dá certo"):
 *  1. Gratuito com 1 anúncio ativo + 3 rascunhos: os rascunhos mostram o que falta (a "Vaga no seu plano" só aparece quando é o único bloqueio).
 *  2. Assinatura mostra o plano REAL e "1 de 1 anúncio ativo"; sem o seletor de demonstração.
 *  3. Sem CPF: aviso + botão de assinar travado; com CPF: assina o Essencial (simulado).
 *  4. Fundador: a tela mostra Profissional sem custo (e não "Gratuito").
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });

const senha = randomBytes(12).toString("hex");
const sufixo = randomBytes(3).toString("hex");
const dono = { email: `dono.planos.${sufixo}@lab.vivanomads.test`, nome: "Paula Planos" };
let donoId = "";

async function imovel(n: number, status: "active" | "draft") {
  const { error } = await adm()
    .from("properties")
    .insert({
      owner_id: donoId, title: `Imóvel ${n} da Paula T34 ${sufixo}`, description: "Imóvel de teste do laboratório (T34): mobiliado, com home office, internet e cozinha completa. Pronto para morar.".repeat(2),
      property_type: "Studio", address: "Centro", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 30,
      min_period_days: 30, max_period_days: 180, monthly_price: 2000 + n * 100, garantias_aceitas: ["caucao"], status,
    });
  if (error) throw error;
}

async function entrar(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.locator('input[name="email"], input[type="email"]').first().fill(dono.email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return page;
}

test.describe("T34 — Jornada do dono: vários imóveis e troca de plano", () => {
  test.skip(process.env.INTEGRACOES_SIMULADAS !== "on" || !URL || !SERVICE, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const { data, error } = await adm().auth.admin.createUser({ email: dono.email, password: senha, email_confirm: true, user_metadata: { full_name: dono.nome } });
    if (error) throw error;
    donoId = data.user.id;
    const { error: e2 } = await adm().from("profiles").upsert({ id: donoId, email: dono.email, full_name: dono.nome, role: "owner", cpf: null }, { onConflict: "id" });
    if (e2) throw e2;
    await imovel(1, "active");
    for (const n of [2, 3, 4]) await imovel(n, "draft");
  });

  test.afterAll(async () => {
    if (donoId) await adm().auth.admin.deleteUser(donoId);
  });

  test("Gratuito: 1 ativo, os outros 3 mostram o que falta para publicar", async ({ browser }) => {
    const page = await entrar(browser);
    await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    await expect(page.getByText(`Imóvel 4 da Paula T34 ${sufixo}`)).toBeVisible({ timeout: 15_000 });
    // Regra vigente (ordem de8761b0, item 2): "Vaga no seu plano" só aparece quando é o ÚNICO bloqueio.
    // Estes rascunhos não têm fotos nem documento aprovado, então a lista mostra o que falta (e não a vaga).
    const cartoes = page.getByTestId("prontidao");
    await expect(cartoes.filter({ hasText: "Falta para publicar" })).toHaveCount(3);
    await expect(cartoes.filter({ hasText: "Vaga no seu plano" })).toHaveCount(0);
    await page.screenshot({ path: "tests/laboratorio/saida/t34-1-quatro-imoveis.png", fullPage: true });
    await page.context().close();
  });
});
