import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T888 — E465 (PC9): "Resumo anual em PDF" do parceiro. Antes: clique sem navegação, sem aviso e sem prova de
 * download. Agora: o clique gera o PDF, o aviso diz "PDF gerado e baixado: resumo-servicos-AAAA.pdf", e o download
 * acontece de verdade (arquivo começa com %PDF-). 390 e 1280 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const parc = { email: `parc.t888.${sufixo}@lab.vivanomads.test`, nome: "Lia Resumo", role: "tenant" as const };
const ids: { parc?: string } = {};

test.describe("T888 — E465: resumo anual do parceiro gera, baixa e avisa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.parc = await criarConta(parc, senha);
    const { error } = await adm().from("parceiros").insert({
      user_id: ids.parc,
      tipo_pessoa: "pf",
      documento: cpfAleatorio(),
      nome_publico: `Lia Resumo ${sufixo}`,
      slug: `t888-${sufixo}`,
      categorias: ["limpeza"],
      cidades: ["Uberlândia"],
      status: "rascunho",
    });
    if (error) throw error;
  });

  test.afterAll(async () => {
    if (ids.parc) await adm().from("parceiros").delete().eq("user_id", ids.parc);
    await apagarContas([ids.parc]);
  });

  for (const largura of [390, 1280]) {
    test(`a ${largura}px: o clique baixa o PDF e mostra a confirmação`, async ({ browser }) => {
      test.setTimeout(90_000);
      const page = await entrar(browser, parc.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      const ano = new Date().getUTCFullYear();
      const botao = page.getByTestId("parceiro-resumo-anual").filter({ hasText: `Resumo anual ${ano}` });
      await expect(botao).toBeVisible({ timeout: 30_000 });
      const [download] = await Promise.all([page.waitForEvent("download"), botao.click()]);
      expect(download.suggestedFilename()).toBe(`resumo-servicos-${ano}.pdf`);
      const caminho = await download.path();
      expect(readFileSync(caminho!).subarray(0, 5).toString()).toBe("%PDF-");
      await expect(page.getByTestId("parceiro-resumo-anual-aviso").first()).toHaveText(`PDF gerado e baixado: resumo-servicos-${ano}.pdf.`);
      await expect(page).toHaveURL(/\/dashboard\/parceiro/);
      await page.context().close();
    });
  }
});
