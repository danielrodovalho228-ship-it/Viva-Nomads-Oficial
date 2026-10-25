import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T454 — Adendo ao E82-A ("Avisar-me" na busca): a frase depois de salvar diz se o aviso por e-mail está ligado.
 *  1. Logado, avisos por e-mail ligados: "Busca salva. Vamos te avisar por e-mail…" + "Não me avisar" (≥ 44 px, foco
 *     visível) → desliga o alerta desta busca no banco e a frase vira "Busca salva, sem aviso por e-mail…".
 *  2. Logado, avisos por e-mail desligados (profiles.notif_email = false): "Seus avisos por e-mail estão desligados." +
 *     "Ligar em Notificações".
 *  3. Visitante: "Busca guardada neste aparelho. Entre com seu e-mail para receber alertas."
 *  Em 390 e 1280 px, com prints dos três estados.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const email = (k: string) => `avisar.${k}.${sufixo}@lab.vivanomads.test`;
const BUSCA = (n: number) => `/buscar?local=Uberl%C3%A2ndia&quartos=${n}`;

async function salvar(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const botao = page.getByTestId("salvar-busca").filter({ visible: true });
  // Com resultado, "Salvar busca" na linha da contagem; sem, "Criar alerta desta busca" — o MESMO componente e o mesmo texto.
  await expect(botao).toHaveText(/^(Salvar busca|Criar alerta desta busca)$/, { timeout: 15_000 });
  await botao.click();
  const aviso = page.getByTestId("salvar-busca-aviso").filter({ visible: true });
  await expect(aviso).toBeVisible({ timeout: 15_000 });
  await expect(aviso).toHaveAttribute("role", "status");
  return aviso;
}

test.describe("T454 — Salvar busca: o aviso por e-mail dito na hora", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas novas).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    for (const k of ["ligado", "desligado"]) ids[k] = await criarConta({ email: email(k), nome: `Morador ${k} Sobrenome`, role: "tenant" }, senha);
    await adm().from("profiles").update({ notif_email: false }).eq("id", ids.desligado);
  });
  test.afterAll(async () => {
    await apagarContas(Object.values(ids));
  });

  for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
    test(`1. ${largura}px — avisos ligados: 'Vamos te avisar…' e 'Não me avisar' desliga só esta busca`, async ({ browser }) => {
      const page = await entrar(browser, email("ligado"), senha);
      await page.setViewportSize({ width: largura, height: altura });
      const n = largura === 390 ? 1 : 2;
      const aviso = await salvar(page, BUSCA(n));
      await expect(aviso).toHaveAttribute("data-tipo", "com_email");
      await expect(aviso).toContainText("Busca salva. Vamos te avisar por e-mail quando surgir um imóvel assim.");
      const nao = aviso.getByTestId("salvar-busca-nao-avisar");
      await expect(nao).toHaveText("Não me avisar");
      expect((await nao.boundingBox())!.height, "toque de 44 px").toBeGreaterThanOrEqual(44);
      // Foco pelo teclado (o anel é de :focus-visible, que o clique do mouse não liga): Tab sai e Shift+Tab volta.
      await nao.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(nao).toBeFocused();
      expect(await nao.evaluate((el) => el.matches(":focus-visible") && getComputedStyle(el).boxShadow !== "none"), "foco visível").toBe(true);
      await page.screenshot({ path: `${SAIDA}/t454-1-avisar-${largura}.png`, fullPage: false });
      await nao.click();
      await expect(aviso).toHaveAttribute("data-tipo", "sem_aviso", { timeout: 15_000 });
      await expect(aviso).toContainText("Busca salva, sem aviso por e-mail. Você pode ligar em Buscas salvas.");
      const { data } = await adm().from("buscas_salvas").select("alerta_ativo, parametros").eq("usuario_id", ids.ligado);
      expect((data ?? []).find((b) => String(b.parametros).includes(`quartos=${n}`))?.alerta_ativo).toBe(false);
      await page.screenshot({ path: `${SAIDA}/t454-1-sem-aviso-${largura}.png`, fullPage: false });
      await page.context().close();
    });

    test(`2. ${largura}px — avisos por e-mail desligados: a frase diz isso e leva a Notificações`, async ({ browser }) => {
      const page = await entrar(browser, email("desligado"), senha);
      await page.setViewportSize({ width: largura, height: altura });
      const aviso = await salvar(page, BUSCA(largura === 390 ? 1 : 2));
      await expect(aviso).toHaveAttribute("data-tipo", "email_desligado");
      await expect(aviso).toContainText("Busca salva. Seus avisos por e-mail estão desligados.");
      const ligar = aviso.getByTestId("salvar-busca-ligar-notificacoes");
      await expect(ligar).toHaveText("Ligar em Notificações");
      await expect(ligar).toHaveAttribute("href", "/dashboard/conta/notificacoes");
      expect((await ligar.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `${SAIDA}/t454-2-desligado-${largura}.png`, fullPage: false });
      await page.context().close();
    });

    test(`3. ${largura}px — visitante: a busca fica no aparelho`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      const aviso = await salvar(page, BUSCA(1));
      await expect(aviso).toHaveAttribute("data-tipo", "convidado");
      await expect(aviso).toContainText("Busca guardada neste aparelho. Entre com seu e-mail para receber alertas.");
      await expect(aviso.getByTestId("salvar-busca-nao-avisar")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t454-3-visitante-${largura}.png`, fullPage: false });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  }
});
