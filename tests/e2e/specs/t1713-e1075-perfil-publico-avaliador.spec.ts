import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T1713 — E1075 (ORDEM-DUET-355, decisão do Daniel de 21/11/2026): a página pública do avaliador do Rogério Silva, sem
  esperar pelo CNPJ. Um visitante abre /avaliadores/<número> e vê o nome, o selo "Avaliador sócio da Viva", a cidade, o
  número e os estados vazios honestos (0 avaliações feitas, conduta ainda sem avaliações), sem botão de escolher.
  A trava morde: sem o registo do perfil (escondido aqui, e reposto no fim), a página não mostra o perfil — dá 404.
  O registo vem da migração 0349, a mesma que entra em produção. 390 e 1280.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
let numero = "";

test.describe("T1713 — E1075: o perfil público do avaliador do Rogério", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    const { data, error } = await adm()
      .from("avaliadores_perfil_publico")
      .select("numero")
      .eq("nome_publico", "Rogério Silva")
      .eq("cidade", "Uberlândia")
      .single();
    if (error) throw error;
    numero = data.numero as string;
  });

  test.afterAll(async () => {
    // Repõe o registo como a migração o deixa, mesmo se o teste da trava falhar a meio.
    if (numero) await adm().from("avaliadores_perfil_publico").update({ publicado: true }).eq("numero", numero);
  });

  for (const largura of LARGURAS) {
    test(`${largura}px — o visitante vê nome, selo, cidade, número e os estados vazios, sem botão`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: 900 } });
      const page = await ctx.newPage();
      const r = await page.goto(`/avaliadores/${numero}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      const perfil = page.getByTestId("avaliador-perfil-publico");
      await expect(perfil.getByRole("heading", { level: 1 })).toHaveText("Rogério Silva");
      await expect(perfil.getByTestId("avaliador-selo")).toHaveText("Avaliador sócio da Viva");
      await expect(perfil.getByTestId("avaliador-cidade")).toHaveText("Uberlândia");
      await expect(perfil.getByTestId("avaliador-numero")).toHaveText(numero);
      // E1079 (asserção alterada): o estado vazio honesto é o cartão "Novo na Viva" do desenho aprovado.
      await expect(perfil.getByTestId("avaliador-novo")).toContainText("Novo na Viva");
      await expect(perfil.getByTestId("avaliador-novo")).toContainText("Este avaliador ainda não tem avaliações");
      await expect(perfil).not.toContainText(/credenciad/i);
      await expect(perfil.getByRole("button")).toHaveCount(0);
      await expect(perfil.getByRole("link")).toHaveCount(0);
      // Pedido do Daniel (21/11 12:20): sem telefone nem e-mail do Rogério, nem no HTML do perfil.
      expect(await perfil.innerHTML()).not.toMatch(/tel:|mailto:|wa\.me|whatsapp|@/i);
      await expect(page).toHaveTitle(new RegExp(`Avaliador nº ${numero}`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t1713-perfil-${largura}.png`, fullPage: true });
      await ctx.close();
    });
  }

  test("a trava morde: sem o registo publicado, a página não mostra o perfil do Rogério (404)", async ({ browser }) => {
    await adm().from("avaliadores_perfil_publico").update({ publicado: false }).eq("numero", numero);
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const r = await page.goto(`/avaliadores/${numero}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
    await expect(page.getByTestId("avaliador-perfil-publico")).toHaveCount(0);
    await expect(page.getByText("Rogério Silva")).toHaveCount(0);
    await ctx.close();
    await adm().from("avaliadores_perfil_publico").update({ publicado: true }).eq("numero", numero);
  });
});
