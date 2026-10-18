import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha } from "../fixtures/laboratorio";

/*
  T201 — QA do Muse (18/10), 390 e 1280 px:
  1. /parceiros/fotografos: busca sem fotógrafo tem saída ("Ainda não temos…" + "Deixe seu contato e avisamos…");
     visitante entra para ser avisado; logado grava o aviso (0162). CEP não encontrado explica o que fazer.
  2. Home: os 4 passos com foto real — nenhum "Foto do passo em breve" no site.
  3. /como-funciona: a foto do topo carrega (prints 390/1280).
  4. Imóvel, visitante sem login: "Agendar visita" e "Visita por vídeo" levam ao login e voltam ao imóvel com a janela
     aberta.
*/
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [390, 1280] as const;

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T201 — QA do Muse", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const largura of LARGURAS) {
    test(`${largura}px — fotógrafos: busca vazia tem saída (avise-me) e CEP não encontrado explica`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/parceiros/fotografos?cidade=Araguari", { waitUntil: "domcontentloaded" });
      const vazio = page.getByTestId("fotografos-vazio");
      await expect(vazio).toContainText("Ainda não temos fotógrafo parceiro em Araguari.");
      await expect(vazio.getByTestId("aviso-fotografo")).toContainText("Deixe seu contato e avisamos quando houver fotógrafo na sua cidade.");
      const entrar = vazio.getByTestId("aviso-fotografo-entrar");
      await expect(entrar).toHaveAttribute("href", /\/auth\?redirect=%2Fparceiros%2Ffotografos%3Fcidade%3DAraguari/);
      await vazio.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t201-fotografos-vazio-${largura}.png`, fullPage: false });
      await semRolagemLateral(page);
      // CEP que não resolve: a tela diz o que fazer (digitar a cidade), nunca fica sem resposta.
      await page.goto("/parceiros/fotografos?cep=00000000", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("fotografos-cep-nao-encontrado")).toContainText("digite só a cidade");
    });

    test(`${largura}px — home: 4 passos com foto real; /como-funciona: foto do topo carrega`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Foto do passo em breve")).toHaveCount(0);
      const passos = page.getByTestId("passos-home");
      await passos.scrollIntoViewIfNeeded();
      const imgs = passos.locator("img");
      await expect(imgs).toHaveCount(4);
      for (let i = 0; i < 4; i++) {
        await imgs.nth(i).scrollIntoViewIfNeeded();
        await expect.poll(() => imgs.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      }
      await passos.screenshot({ path: `${SAIDA}/t201-home-passos-${largura}.png` });

      await page.goto("/como-funciona", { waitUntil: "domcontentloaded" });
      const banner = page.getByTestId("banner-topo");
      const foto = banner.locator("img").first();
      await expect.poll(() => foto.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      await expect(page.getByText("Foto do passo em breve")).toHaveCount(0);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SAIDA}/t201-como-funciona-topo-${largura}.png`, fullPage: false });
      await semRolagemLateral(page);
    });
  }

  test.describe("logado", () => {
    test.skip(!hasAccount("proprietario"), "conta de proprietário do laboratório não configurada");
    test.use({ storageState: authFile("proprietario") });
    test("390px — fotógrafos: logado pede para ser avisado e o aviso fica gravado por cidade", async ({ page }) => {
      test.skip(!NO_LABORATORIO, "grava no banco: só no laboratório");
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto("/parceiros/fotografos?cidade=Araguari", { waitUntil: "domcontentloaded" });
      // toque antes da hidratação não dispara a ação (instável no lab): repete até o aviso aparecer (gravar é idempotente)
      await expect(async () => {
        const enviar = page.getByTestId("aviso-fotografo-enviar");
        if (await enviar.isVisible()) await enviar.click();
        await expect(page.getByTestId("aviso-fotografo-ok")).toContainText("Avisamos você quando houver fotógrafo parceiro em Araguari", { timeout: 5_000 });
      }).toPass({ timeout: 40_000 });
      const { count } = await adm().from("interesse_fotografo_cidade").select("id", { count: "exact", head: true }).eq("chave", "araguari").eq("uf", "MG");
      expect(count).toBeGreaterThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t201-fotografos-avisado-390.png`, fullPage: false });
    });
  });

  test.describe("visita sem login", () => {
    test.skip(!NO_LABORATORIO, "cria imóvel e conta: só no laboratório");
    test.describe.configure({ mode: "serial" });
    const senha = novaSenha();
    const ids: string[] = [];
    let imovel = "";
    test.beforeAll(async () => {
      const dono = await criarConta({ email: `dono.t201.${randomBytes(3).toString("hex")}@lab.vivanomads.test`, nome: "Otto Visitado Sobrenome", role: "owner" }, senha);
      ids.push(dono);
      imovel = await criarImovelPronto(dono, "Studio do QA da visita", { ativo: true });
    });
    test.afterAll(async () => {
      if (imovel) await adm().from("visitas_video").delete().eq("property_id", imovel);
      await apagarContas(ids);
    });

    for (const [alvo, botao, prova] of [
      ["visita", "agendar-visita", "Agendar uma visita"],
      ["video", "visita-video-abrir", "visita-video-horario-0"],
    ] as const) {
      for (const largura of LARGURAS) {
        test(`${largura}px — "${alvo}": sem login vai ao login e volta ao imóvel com a janela aberta`, async ({ page }) => {
          test.setTimeout(90_000);
          const email = `inq.t201.${alvo}.${largura}.${randomBytes(3).toString("hex")}@lab.vivanomads.test`;
          ids.push(await criarConta({ email, nome: "Iara Visitante Sobrenome", role: "tenant" }, senha));
          await page.setViewportSize({ width: largura, height: 900 });
          await page.goto(`/imoveis/${imovel}`, { waitUntil: "domcontentloaded" });
          const b = page.getByTestId(botao).first();
          await b.scrollIntoViewIfNeeded();
          // A sessão é conferida no carregamento: reclica até a navegação para o login acontecer.
          await expect(async () => {
            if (!/\/auth/.test(page.url())) await b.click({ timeout: 3_000 });
            await expect(page).toHaveURL(/\/auth\?redirect=/, { timeout: 3_000 });
          }).toPass({ timeout: 30_000 });
          expect(decodeURIComponent(page.url())).toContain(`/imoveis/${imovel}?abrir=${alvo}`);
          await page.locator('input[name="email"], input[type="email"]').first().fill(email);
          await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
          await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
          await expect(page).toHaveURL(new RegExp(`/imoveis/${imovel}\\?abrir=${alvo}`), { timeout: 30_000 });
          if (alvo === "visita") await expect(page.getByText(prova).first()).toBeVisible({ timeout: 20_000 });
          else await expect(page.getByTestId(prova)).toBeVisible({ timeout: 20_000 });
          await page.screenshot({ path: `${SAIDA}/t201-visita-${alvo}-aberta-${largura}.png`, fullPage: false });
        });
      }
    }
  });
});
