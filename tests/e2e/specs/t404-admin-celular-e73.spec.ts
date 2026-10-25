import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T404 — E73 (QA 24/10): o /admin no celular. 390 e 1280 px.
   (a) no celular, "Voltar ao site" e "Menu da equipe" à vista no topo; o menu abre a navegação da equipe; no computador
       essa faixa não aparece (a barra lateral já está lá);
   (b) backup vermelho: no celular o alerta sobe para o topo (role=alert) com "Ver o backup"; no computador, não;
   (c) a linha de "Precisa da sua atenção" inteira é tocável (tocar fora do texto e do botão abre a mesma lista);
   (d) ADMIN-4: os 4 números da inicial (cada um link) vêm antes da atenção, no celular e no computador (a antiga faixa
       só do celular saiu: os números já são os mesmos nas duas larguras).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t404.${sufixo}@lab.vivanomads.test`, nome: "Dalva Celular Prado", role: "owner" as const };
const inq = { email: `inq.t404.${sufixo}@lab.vivanomads.test`, nome: "Ivo Celular Prado", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T404 — E73: o admin no celular", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.use({ storageState: authFile("admin") });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do admin no celular ${sufixo}`, { ativo: true, preco: 2800 });
    // Candidatura sem resposta há 3 dias: garante ao menos uma linha de decisão.
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, false);
    await adm().from("leads").update({ created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }).eq("id", ids.lead);
  });
  test.afterAll(async () => {
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura}px — navegação, alerta do backup, linha tocável e números-chave`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("admin-numeros")).toBeVisible({ timeout: 25_000 });
      const celular = largura === 390;

      // (a) navegação à vista no celular.
      const nav = page.getByTestId("admin-nav-celular");
      if (celular) {
        await expect(nav).toBeVisible();
        await expect(page.getByTestId("admin-voltar-site")).toHaveAttribute("href", "/");
        await expect(page.getByTestId("admin-abrir-menu")).toHaveText("Menu da equipe");
      } else {
        await expect(nav).toBeHidden();
      }

      // (b) alerta do backup: só no celular e só quando o cartão está vermelho.
      const vermelho = Number(await page.getByTestId("admin-saude").getAttribute("data-alertas")) > 0;
      const alerta = page.getByTestId("alerta-backup");
      if (celular && vermelho) {
        await expect(alerta).toBeVisible();
        await expect(alerta).toHaveAttribute("role", "alert");
        await expect(page.getByTestId("alerta-backup-ver")).toHaveAttribute("href", "/admin/sistema#backup");
        const [a, d] = await Promise.all([alerta.boundingBox(), page.getByTestId("admin-numeros").boundingBox()]);
        expect(a!.y, "alerta antes dos números").toBeLessThan(d!.y);
      } else {
        await expect(alerta).toBeHidden();
      }

      // (d) os 4 números antes da atenção; cada número é link.
      const numeros = page.getByTestId("admin-numeros");
      await expect(numeros.locator("a")).toHaveCount(4);
      await expect(page.getByTestId("admin-numero-anuncios")).toHaveAttribute("href", "/admin/imoveis?tipo=real");
      const [f, d] = await Promise.all([numeros.boundingBox(), page.getByTestId("admin-atencao").boundingBox()]);
      expect(f!.y, "números antes da atenção").toBeLessThan(d!.y);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t404-admin-topo-${largura}.png` });

      // (c) linha de decisão tocável: um toque no canto da linha (fora do texto e do botão) cai no link da linha.
      const linha = page.locator("[data-decisao]").first();
      await expect(linha).toBeVisible();
      const destino = await linha.locator("[data-href]").getAttribute("href");
      const caixa = (await linha.boundingBox())!;
      const alvo = { x: caixa.x + 4, y: caixa.y + 4 };
      const naLinha = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest("[data-decisao] a[data-href]")?.getAttribute("href") ?? null;
      }, alvo);
      expect(naLinha).toBe(destino);
      if (celular) {
        await page.getByTestId("admin-abrir-menu").click();
        await expect(page.getByTestId("menu-cascata").filter({ visible: true }).locator('a[href="/admin"]')).toBeVisible();
        await page.screenshot({ path: `${SAIDA}/t404-admin-menu-390.png` });
        await page.keyboard.press("Escape");
        await page.goto("/admin", { waitUntil: "domcontentloaded" });
        await page.locator("[data-decisao]").first().waitFor({ timeout: 25_000 });
      }
      await page.mouse.click(alvo.x, alvo.y);
      await page.waitForURL((u) => `${u.pathname}${u.search}` === destino, { timeout: 20_000 });
    });
  }
});
