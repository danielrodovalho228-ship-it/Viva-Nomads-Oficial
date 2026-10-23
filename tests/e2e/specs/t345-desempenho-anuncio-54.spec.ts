import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T345 — Prompt 54: painel de desempenho do anúncio (390 / 1280).
 *   • massa de eventos: 6 visualizações reais + 1 do próprio dono + 1 de conta de teste → o painel mostra 6;
 *     1 favorito; 1 candidatura → conversão 16,7%;
 *   • todo número tem a fórmula escrita; grupo de parecidos com menos de 5 não compara;
 *   • nenhum texto de ganho estimado; atalho em Meus imóveis.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t345.${sufixo}@lab.vivanomads.test`, nome: "Dina Desempenho", role: "owner" as const };
const qa = { email: `qa.t345.${sufixo}@lab.vivanomads.test`, nome: "Quim Teste", role: "tenant" as const };
const ids: { dono?: string; qa?: string; imovel?: string } = {};
const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

test.describe("T345 — Prompt 54: desempenho do anúncio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.qa = await criarConta(qa, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.qa);
    // Cidade única: o grupo de parecidos fica com menos de 5 (não compara).
    ids.imovel = await criarImovelPronto(ids.dono, `Studio desempenho ${sufixo}`, { ativo: true, preco: 2600 });
    await adm().from("properties").update({ city: `Cidade T345 ${sufixo}` }).eq("id", ids.imovel);
    const ev = (tipo: string, h: number, usuario: string | null = null) => ({ tipo, criado_em: horasAtras(h), usuario_id: usuario, imovel_id: ids.imovel });
    const { error } = await adm()
      .from("eventos")
      .insert([
        ...[2, 3, 4, 5, 6, 7].map((h) => ev("ver_anuncio", h)),
        ev("ver_anuncio", 8, ids.dono),
        ev("ver_anuncio", 9, ids.qa),
        ev("favoritar", 3),
        ev("enviar_candidatura", 4),
        ev("enviar_candidatura", 5, ids.qa),
        ev("ver_anuncio", 24 * 40),
      ]);
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("eventos").delete().eq("imovel_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.qa]);
  });

  test("números com fórmula, dono e conta de teste fora, sem comparação com grupo pequeno", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("desempenho-link").first()).toBeVisible({ timeout: 30_000 });

    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/${ids.imovel}/desempenho`, { waitUntil: "domcontentloaded" });
      const metricas = page.getByTestId("desempenho-metricas");
      await expect(metricas).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("desempenho-visualizacoes")).toHaveAttribute("data-valor", "6");
      await expect(page.getByTestId("desempenho-favoritos")).toHaveAttribute("data-valor", "1");
      await expect(page.getByTestId("desempenho-candidaturas")).toHaveAttribute("data-valor", "1");
      await expect(page.getByTestId("desempenho-conversao")).toHaveAttribute("data-valor", "16.7");
      await expect(page.getByTestId("desempenho-visualizacoes")).toContainText("↑ 5 em relação aos 30 dias anteriores.");
      // Todo número com fórmula escrita.
      await expect(page.getByTestId("desempenho-formula")).toHaveCount(5);
      await expect(page.getByTestId("desempenho-visualizacoes")).toContainText("Ainda não há imóveis parecidos suficientes para comparar.");
      await expect(page.getByTestId("desempenho-grupo")).toHaveAttribute("data-parecidos", "0");
      await expect(page.getByTestId("desempenho-semana")).toHaveCount(8);
      await expect(page.locator("main")).not.toContainText(/ganho estimado|vai render|ganhar/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t345-desempenho-${largura}.png`, fullPage: true });
    }
    await page.context().close();
  });
});
