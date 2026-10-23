import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T329 — 44-B2: preferências por categoria e o cartão "Push" do admin.
 *   1. /dashboard/notificacoes (390 / 1280): Decisões e Segurança aparecem sem interruptor ("Sempre chegam");
 *      Mensagens, Lembretes e Outros avisos têm interruptor; desligar Mensagens grava no perfil e continua desligado
 *      depois de recarregar; religar volta ao padrão (nada desligado).
 *   2. /admin › Push: aparelhos por plataforma, entregues, falhas e tokens mortos dos últimos 7 dias; o que é de conta
 *      de teste (is_teste) e o que tem mais de 7 dias não entra; botão "Enviar push de teste para mim".
 * O envio real do push (servidor Expo falso) fica para o laboratório da Pista C.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `mor.t329.${sufixo}@lab.vivanomads.test`, nome: "Paula Preferência", role: "tenant" as const };
const qa = { email: `qa.t329.${sufixo}@lab.vivanomads.test`, nome: "Quina Teste", role: "tenant" as const };
const ids: { pessoa?: string; qa?: string } = {};

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function desligadasNoBanco(): Promise<string[]> {
  const { data } = await adm().from("profiles").select("notif_categorias_desligadas").eq("id", ids.pessoa!).single();
  return (data?.notif_categorias_desligadas as string[]) ?? [];
}

test.describe("T329 — 44-B2: preferências por categoria e diagnóstico do push", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    ids.qa = await criarConta(qa, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.qa);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("push_envios").delete().in("user_id", [ids.pessoa, ids.qa].filter(Boolean) as string[]);
    await adm().from("push_tokens").delete().in("user_id", [ids.pessoa, ids.qa].filter(Boolean) as string[]);
    await apagarContas([ids.pessoa, ids.qa]);
  });

  test("1. decisões e segurança sempre chegam; mensagens desliga e fica desligado", async ({ browser }) => {
    const page = await entrar(browser, pessoa.email, senha);
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("notif-categorias");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      for (const c of ["decisao", "seguranca"]) {
        await expect(page.getByTestId(`notif-categoria-${c}`)).toContainText("Sempre chegam");
        await expect(page.getByTestId(`notif-categoria-${c}`).getByRole("switch")).toHaveCount(0);
      }
      for (const c of ["mensagens", "lembretes", "outros"]) {
        await expect(page.getByTestId(`notif-categoria-${c}`).getByRole("switch")).toHaveCount(1);
      }
      await semRolagemLateral(page);
      await bloco.screenshot({ path: `tests/laboratorio/saida/t329-categorias-${largura}.png` });
    }

    const mensagens = page.getByTestId("notif-categoria-mensagens").getByRole("switch");
    await expect(mensagens).toHaveAttribute("aria-checked", "true");
    await expect(mensagens).toBeEnabled();
    await mensagens.click();
    await expect(page.getByText("Preferência salva.")).toBeVisible();
    await expect.poll(desligadasNoBanco).toEqual(["mensagens"]);

    await page.reload({ waitUntil: "domcontentloaded" });
    const depois = page.getByTestId("notif-categoria-mensagens").getByRole("switch");
    await expect(depois).toHaveAttribute("aria-checked", "false", { timeout: 20_000 });
    await expect(page.getByTestId("notif-categoria-lembretes").getByRole("switch")).toHaveAttribute("aria-checked", "true");

    await expect(depois).toBeEnabled();
    await depois.click();
    await expect(page.getByText("Preferência salva.")).toBeVisible();
    await expect.poll(desligadasNoBanco).toEqual([]);
    await page.context().close();
  });

  test.describe("2. admin", () => {
    test.use({ storageState: authFile("admin") });

    async function numeros(page: Page) {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("cartao-push");
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      const n = async (id: string) => Number((await page.getByTestId(id).locator("dd").first().innerText()).trim());
      return { aparelhos: await n("cartao-push-aparelhos"), entregues: await n("cartao-push-entregues"), falhas: await n("cartao-push-falhas"), mortos: await n("cartao-push-mortos") };
    }

    test("2. cartão Push: conta de teste e envio antigo não entram", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const antes = await numeros(page);
      const agora = Date.now();
      const { error: e1 } = await adm()
        .from("push_tokens")
        .insert([
          { user_id: ids.pessoa, token: `ExponentPushToken[t329-${sufixo}-a]`, platform: "android" },
          { user_id: ids.qa, token: `ExponentPushToken[t329-${sufixo}-q]`, platform: "ios" },
        ]);
      expect(e1).toBeNull();
      const { error: e2 } = await adm()
        .from("push_envios")
        .insert([
          { user_id: ids.pessoa, evento: "proposta_recebida", enviados: 3, falhas: 1, tokens_mortos: 1, criado_em: new Date(agora - 3_600_000).toISOString() },
          { user_id: ids.pessoa, evento: "proposta_recebida", enviados: 500, falhas: 500, tokens_mortos: 500, criado_em: new Date(agora - 9 * 86_400_000).toISOString() },
          { user_id: ids.qa, evento: "new_message", enviados: 700, falhas: 700, tokens_mortos: 700, criado_em: new Date(agora - 3_600_000).toISOString() },
        ]);
      expect(e2).toBeNull();

      const depois = await numeros(page);
      // Outros testes podem enviar push ao mesmo tempo: só as linhas desta conta são exatas; as de teste e as antigas
      // (centenas) nunca podem aparecer.
      expect(depois.aparelhos - antes.aparelhos).toBeGreaterThanOrEqual(1);
      expect(depois.aparelhos - antes.aparelhos).toBeLessThan(2 + 10);
      expect(depois.entregues - antes.entregues).toBeGreaterThanOrEqual(3);
      expect(depois.entregues - antes.entregues).toBeLessThan(500);
      expect(depois.falhas - antes.falhas).toBeGreaterThanOrEqual(1);
      expect(depois.falhas - antes.falhas).toBeLessThan(500);
      expect(depois.mortos - antes.mortos).toBeGreaterThanOrEqual(1);
      expect(depois.mortos - antes.mortos).toBeLessThan(500);
      await expect(page.getByTestId("cartao-push").getByRole("button", { name: "Enviar push de teste para mim" })).toBeVisible();

      for (const largura of [390, 1280]) {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await page.goto("/admin", { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("cartao-push")).toBeVisible({ timeout: 30_000 });
        await semRolagemLateral(page);
        await page.getByTestId("cartao-push").screenshot({ path: `tests/laboratorio/saida/t329-cartao-push-${largura}.png` });
      }
    });
  });
});
