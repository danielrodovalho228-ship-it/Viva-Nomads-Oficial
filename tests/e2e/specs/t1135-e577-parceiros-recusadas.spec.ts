import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1135 — E577 (#2558, 05/11): em Admin → Parceiros, aba Recusadas, o pedido recusado é só leitura — "Pedido recusado
 * em <data>", o motivo, e NENHUMA ação (sem checklist, sem Aprovar, sem Recusar; o servidor já recusa os dois). Antes,
 * a ficha recusada mostrava o checklist e os botões. Entrou com teste de unidade; aqui é a tela do admin, 390 e 1280,
 * com um pedido semeado (como a t826) já recusado, com motivo e data de decisão.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `recusada.t1135.${sufixo}@lab.vivanomads.test`, nome: "Rita Recusada", role: "tenant" as const };
const MOTIVO = `Portfólio sem fotos de imóveis (${sufixo}).`;
const ids: Record<string, string> = {};

test.describe("T1135 — E577: o pedido de parceria recusado é só leitura, com motivo e data", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    const { error } = await adm().from("parceiro_solicitacoes").insert({
      user_id: ids.pessoa,
      email: pessoa.email,
      nome: pessoa.nome,
      tipo_pessoa: "pf",
      documento: cpfAleatorio(),
      categorias: ["fotografia"],
      cidades: ["Uberlândia"],
      portfolio_url: "https://exemplo.lab.vivanomads.test",
      status: "recusada",
      motivo_recusa: MOTIVO,
      decidido_em: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      origem: "site",
    });
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("parceiro_solicitacoes").delete().eq("user_id", ids.pessoa ?? "");
    await apagarContas([ids.pessoa]);
  });

  for (const w of [390, 1280] as const) {
    test(`aba Recusadas: "Pedido recusado em …", o motivo e nenhuma ação (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        await page.goto("/admin/parceiros?aba=recusadas", { waitUntil: "domcontentloaded" });
        const ficha = page.getByTestId("ficha-parceria").filter({ hasText: pessoa.email });
        await expect(ficha).toBeVisible({ timeout: 30_000 });
        const bloco = ficha.getByTestId("ficha-recusada");
        await expect(bloco).toContainText(/Pedido recusado em \d{2}\/\d{2}/);
        await expect(ficha.getByTestId("ficha-recusada-motivo")).toHaveText(`Motivo: ${MOTIVO}`);
        await expect(ficha.getByTestId("ficha-checklist")).toHaveCount(0);
        await expect(ficha.getByRole("button", { name: /^Aprovar$/ })).toHaveCount(0);
        await expect(ficha.getByRole("button", { name: /^Recusar$/ })).toHaveCount(0);
        await expect(ficha.getByTestId("ficha-motivo")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
