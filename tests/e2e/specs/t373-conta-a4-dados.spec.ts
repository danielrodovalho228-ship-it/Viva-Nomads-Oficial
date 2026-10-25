import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T373 — CONTA-A A4 (mockup perfil-04): Conta › Dados, título "Meus dados".
 *   1. Um cartão com Nome completo, CPF mascarado (só leitura), Data de nascimento, Telefone, E-mail com a pílula
 *      "E-mail confirmado" e "Salvar". 1280 e 390, com prints.
 *   2. Data de nascimento: recusa data que não existe; grava a certa e volta depois de recarregar.
 */
const SAIDA = "tests/laboratorio/saida";
const ROTA = "/dashboard/conta/dados";

test.describe("T373 — CONTA-A A4: Meus dados (perfil-04)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const conta = { email: `inq.t373.${novoSufixo()}@lab.vivanomads.test`, nome: "Ana Ribeiro", role: "tenant" as const };
  let id = "";
  // Desde a 0237 a data fica em profiles.data_nascimento.
  const nascimento = async () => ((await adm().from("profiles").select("data_nascimento").eq("id", id).maybeSingle()).data as { data_nascimento?: string | null } | null)?.data_nascimento ?? null;
  async function como(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    return p;
  }
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
    // O laboratório já dá um CPF válido e único a cada conta; aqui só o telefone.
    await adm().from("profiles").update({ phone: "(34) 99999-1234" }).eq("id", id);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const w of [1280, 390]) {
    test(`1. a ${w} px: o cartão "Meus dados" do desenho`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto(ROTA, { waitUntil: "domcontentloaded" });
      const cartao = p.getByTestId("meus-dados");
      await cartao.waitFor({ timeout: 20_000 });
      await expect(p.locator("h1:visible")).toHaveText("Meus dados");
      await expect(cartao.getByLabel("Nome completo")).toHaveValue("Ana Ribeiro", { timeout: 20_000 });
      await expect(p.getByTestId("dados-documento")).toHaveValue(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/, { timeout: 20_000 });
      await expect(p.getByTestId("dados-documento")).toHaveAttribute("readonly", "");
      await expect(p.getByTestId("dados-nascimento")).toHaveAttribute("placeholder", "dd/mm/aaaa");
      await expect(cartao.getByLabel("Telefone")).toHaveValue(/99999-1234/);
      await expect(p.getByTestId("dados-email-confirmado")).toHaveText("E-mail confirmado");
      await expect(p.getByTestId("dados-salvar")).toHaveText("Salvar");
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await cartao.screenshot({ path: `${SAIDA}/t373-meus-dados-${w}.png` });
      await p.screenshot({ path: `${SAIDA}/t373-dados-tela-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("2. data de nascimento: recusa a que não existe, grava a certa e volta depois de recarregar", async ({ browser }) => {
    const p = await como(browser, 390);
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    const campo = p.getByTestId("dados-nascimento");
    await campo.waitFor({ timeout: 20_000 });
    await campo.fill("31021991");
    await expect(campo).toHaveValue("31/02/1991");
    await p.getByTestId("dados-salvar").click();
    await expect(p.getByTestId("meus-dados").getByRole("alert")).toHaveText("Data de nascimento inválida.");
    expect(await nascimento()).toBeNull();
    await campo.fill("14031991");
    await p.getByTestId("dados-salvar").click();
    await expect(p.getByText("Dados salvos.")).toBeVisible({ timeout: 20_000 });
    await expect.poll(nascimento, { timeout: 15_000 }).toBe("1991-03-14");
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("dados-nascimento")).toHaveValue("14/03/1991", { timeout: 20_000 });
    await p.context().close();
  });
});
