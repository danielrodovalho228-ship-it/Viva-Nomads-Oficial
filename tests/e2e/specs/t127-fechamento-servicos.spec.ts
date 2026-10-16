import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T127 — Fechamento, etapa "Serviços adicionais" (ordem 3e2b7030; achado do Moacir c643e640).
 * Dono logado chega à etapa 3 a 390 e 1280 px: sem "intermedeia/roteia", "paga direto ao prestador",
 * Assistência 24h marcada "Em breve" e sem poder ser escolhida; sem rolagem lateral.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.serv.${sufixo}@lab.vivanomads.test`, nome: "Dora Serviço", role: "owner" as const };
const inq = { email: `inq.serv.${sufixo}@lab.vivanomads.test`, nome: "Ivo Serviço", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T127 — Fechamento: serviços adicionais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    ids.imovel = await criarImovelPronto(ids.dono, `Serviços ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
  });

  test.afterAll(async () => {
    if (ids.lead) await adm().from("contratos").delete().eq("lead_id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280]) {
    test(`a ${largura} px a Assistência 24h está 'Em breve' e o texto não diz que a Viva intermedeia`, async ({ browser }) => {
      test.setTimeout(120_000);
      const pagina = await entrar(browser, dono.email, senha);
      await pagina.setViewportSize({ width: largura, height: 900 });
      await pagina.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "networkidle" });
      await expect(pagina.getByTestId("inicio-estadia")).toBeVisible({ timeout: 15_000 });
      await pagina.getByRole("button", { name: /continuar/i }).click();
      await pagina.getByRole("radio").and(pagina.locator(":not([disabled])")).first().click();
      await pagina.getByTestId("ciente-protecao").check();
      await pagina.getByRole("button", { name: /continuar/i }).click();

      await expect(pagina.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
      const texto = await pagina.locator("body").innerText();
      expect(texto).not.toMatch(/intermedei|roteia o pagamento/i);
      expect(texto).toContain("paga direto ao prestador");
      const assistencia = pagina.getByTestId("servico-assistencia_24h");
      await expect(assistencia).toContainText("Em breve");
      await expect(assistencia).toBeDisabled();
      expect(await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await pagina.context().close();
    });
  }
});
