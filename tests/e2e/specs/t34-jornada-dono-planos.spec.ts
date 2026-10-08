import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

/**
 * T34 — JORNADA DO DONO: vários imóveis e troca de plano (laboratório). Conta NOVA.
 * O caminho que o Daniel relatou ("coloco um imóvel e tento um plano mais avançado,
 * não dá certo"):
 *  1. Gratuito com 1 anúncio ativo + 3 rascunhos: os rascunhos mostram "Vaga no seu plano".
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

  test("Gratuito: 1 ativo, os outros 3 esbarram na vaga do plano", async ({ browser }) => {
    const page = await entrar(browser);
    await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    await expect(page.getByText(`Imóvel 4 da Paula T34 ${sufixo}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("prontidao").filter({ hasText: "Vaga no seu plano" })).toHaveCount(3);
    await page.screenshot({ path: "tests/laboratorio/saida/t34-1-quatro-imoveis.png", fullPage: true });
    await page.context().close();
  });

  test("Assinatura: plano real, sem seletor de demonstração; sem CPF trava; com CPF assina", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser);
    await page.goto("/dashboard/assinatura", { waitUntil: "networkidle" });
    const atual = page.getByTestId("plano-atual");
    await expect(atual).toContainText("Gratuito");
    await expect(atual).toContainText("1 de 1 anúncio ativo", { timeout: 15_000 });
    await expect(page.getByText("Visualizar como plano (demonstração)")).toHaveCount(0);
    await expect(page.getByTestId("assinatura-sem-documento")).toBeVisible();
    await expect(page.getByRole("button", { name: "Assinar Essencial" })).toBeDisabled();
    await page.screenshot({ path: "tests/laboratorio/saida/t34-2-assinatura-sem-cpf.png", fullPage: true });

    await adm().from("profiles").update({ cpf: cpfAleatorio() }).eq("id", donoId);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("assinatura-sem-documento")).toHaveCount(0, { timeout: 15_000 });
    await page.getByRole("button", { name: "Assinar Essencial" }).click();
    await page.getByRole("button", { name: /Assinar Essencial via pix/i }).click();
    await expect(page.getByText(/Assinatura criada \(modo demonstração\)/)).toBeVisible({ timeout: 15_000 });
    await page.context().close();
  });

  test("Fundador: a tela mostra Profissional sem custo (nunca 'Gratuito')", async ({ browser }) => {
    await adm().from("profiles").update({ fundador: true, fundador_em: new Date().toISOString() }).eq("id", donoId);
    const page = await entrar(browser);
    await page.goto("/dashboard/assinatura", { waitUntil: "networkidle" });
    await expect(page.getByTestId("plano-atual")).toContainText("Profissional", { timeout: 15_000 });
    await expect(page.getByTestId("plano-atual")).toContainText("Fundador: Profissional sem custo até");
    await page.context().close();
  });
});
