import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm, liberarLimiteChamados, NO_LABORATORIO } from "../fixtures/laboratorio";

/**
 * T108 — Admin: a tela do chamado (/admin/atendimento/[id]) nunca mostra código de status
 * (ex.: pendente_aceite) — só texto humano (ordem 0569d129 item 2, achado do Moacir no #595).
 */
test.describe("T108 — Admin: chamado sem código de status", () => {
  test.use({ storageState: authFile("admin") });

  // A prova roda SEMPRE no laboratório: se a fila estiver vazia, o próprio teste abre um chamado
  // pelo chat da /ajuda (como o proprietário), em vez de pular (achado do Moacir, ordem 0569d129 item 2).
  async function chamadoParaAbrir(browser: import("@playwright/test").Browser): Promise<string | null> {
    if (!NO_LABORATORIO) return null;
    await liberarLimiteChamados();
    const dono = await browser.newContext({ storageState: authFile("proprietario") });
    const p = await dono.newPage();
    await p.goto("/ajuda/fale-com-a-viva", { waitUntil: "domcontentloaded" });
    const bloco = p.getByTestId("viva-chat-bloco");
    await bloco.getByRole("button", { name: /Falar com uma pessoa/i }).click();
    await bloco.getByLabel("Pedido para a equipe").fill(`Preciso de ajuda com a minha locação (${Date.now()})`);
    await bloco.getByRole("button", { name: "Abrir chamado" }).click();
    const ok = p.getByTestId("chamado-aberto-chat");
    await expect(ok).toBeVisible({ timeout: 20_000 });
    const numero = (await ok.innerText()).match(/VN-\d+/)![0];
    await dono.close();
    const { data } = await adm().from("chamados").select("id").eq("numero_publico", numero).single();
    return data?.id ?? null;
  }

  for (const largura of [390, 1280]) {
    test(`tela do chamado sem "_" de status a ${largura}px`, async ({ page, browser }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      const semeado = await chamadoParaAbrir(browser);
      if (semeado) {
        await page.goto(`/admin/atendimento/${semeado}`, { waitUntil: "domcontentloaded" });
      } else {
        await page.goto("/admin/atendimento?aba=fila", { waitUntil: "domcontentloaded" });
        const link = page.locator('main a[href^="/admin/atendimento/"]').first();
        test.skip((await link.count()) === 0, "Sem chamado na fila deste ambiente.");
        await link.click();
      }
      await expect(page).toHaveURL(/\/admin\/atendimento\/[0-9a-f-]{36}$/);
      await expect(page.locator("main")).toBeVisible();
      // Dá tempo ao copiloto ("quem é a pessoa") carregar antes de varrer o texto.
      await page.getByTestId("quem-e-a-pessoa").first().waitFor({ timeout: 15_000 }).catch(() => undefined);
      const texto = await page.locator("main").innerText();
      const codigos = texto.match(/\b(?:pendente_aceite|aguardando_[a-z_]+|encerrado_[a-z_]+|em_andamento|removido_admin)\b/g) ?? [];
      expect(codigos, `códigos de status visíveis: ${codigos.join(", ")}`).toEqual([]);
    });
  }
});
