import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T270 — Prompt 46 (D5), o admin na anatomia "decisões primeiro", a 390 e 1280 px:
   1. /admin abre com "Hoje você tem N decisões" (h1); N = a soma das linhas; cada linha tem o número (link) e o botão
      da decisão (secundário — nenhum primário nas decisões) que levam à mesma tela do admin;
   2. o spec cria um pedido de encerramento aberto e uma candidatura parada há 3 dias: as duas linhas aparecem e a
      lista aberta conta o mesmo (encerramentos: linhas não concluídas; candidaturas: lista-total);
   3. depois das decisões, UM número-herói, que abre a lista com a mesma contagem; o resto em listas com divisor fino;
   4. nada de gradiente nem fundo colorido nos números e selos; sem rolagem lateral.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t270.${sufixo}@lab.vivanomads.test`, nome: "Dalva Decide Prado", role: "owner" as const };
const inq = { email: `inq.t270.${sufixo}@lab.vivanomads.test`, nome: "Ivo Decide Prado", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T270 — admin: decisões primeiro", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.use({ storageState: authFile("admin") });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio das decisões do admin ${sufixo}`, { ativo: true, preco: 2800 });
    // Candidatura sem resposta há 3 dias → "candidaturas sem resposta há mais de 48 h".
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, false);
    await adm().from("leads").update({ created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }).eq("id", ids.lead);
    // Contrato + pedido de encerramento aberto → "pedidos de encerramento de contrato".
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        owner_plan: "free", faixa: "media_estadia", tamanho_bloco_meses: 2, comissao_percent: 0.1, qtd_ocupantes: 1, status: "ativo",
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, prazo_total_dias: 90, aluguel_mensal: 2800, comissao_valor: 840,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids.contrato = c!.id as string;
    const { error: eEnc } = await adm()
      .from("contrato_encerramento_pedidos")
      .insert({ contrato_id: ids.contrato, pedido_por: ids.inq, papel: "inquilino", motivo: "acordo_entre_partes" });
    expect(eEnc).toBeNull();
  });

  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("contrato_encerramento_pedidos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura}px — "Hoje você tem N decisões", cada uma com o botão e a lista que conta o mesmo`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      const secao = page.getByTestId("admin-decisoes");
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveText(/^Hoje você tem \d+ decis(ão|ões)$/, { timeout: 25_000 });
      await semRolagemLateral(page);

      // N = soma das linhas; cada linha: link (número) e botão secundário para a MESMA tela do admin.
      const linhas = secao.locator("[data-decisao]");
      const qtd = await linhas.count();
      expect(qtd).toBeGreaterThanOrEqual(2);
      let soma = 0;
      for (let i = 0; i < qtd; i++) {
        const l = linhas.nth(i);
        const link = l.locator("[data-href]").first();
        const href = (await link.getAttribute("data-href"))!;
        soma += Number(await link.getAttribute("data-valor"));
        expect(href).toMatch(/^\/admin/);
        const botao = l.getByRole("link").last();
        expect(await botao.getAttribute("href")).toBe(href);
        expect(await botao.getAttribute("data-cta")).not.toBe("primary");
      }
      expect(Number((await h1.innerText()).match(/\d+/)![0])).toBe(soma);
      await expect(secao.locator('[data-cta="primary"]')).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t270-decisoes-${largura}.png`, fullPage: false });

      // Encerramento aberto: a linha conta o mesmo que a lista de encerramentos (não concluídos).
      const enc = secao.locator('[data-decisao="encerramentos"] [data-href]').first();
      const nEnc = Number(await enc.getAttribute("data-valor"));
      expect(nEnc).toBeGreaterThanOrEqual(1);
      await enc.click();
      await expect(page).toHaveURL(/\/admin\/contratos\/encerramentos/);
      await expect(page.locator('[data-testid="admin-encerramento"]:not([data-status="concluido"])')).toHaveCount(nEnc, { timeout: 20_000 });
      await expect(page.locator(`[data-contrato="${ids.contrato}"]`)).toHaveCount(1);

      // Candidatura parada há 3 dias: a linha conta o mesmo que a lista filtrada.
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      const cand = page.locator('[data-decisao="candidaturas_sem_resposta_48h"] [data-href]').first();
      const nCand = Number(await cand.getAttribute("data-valor"));
      expect(nCand).toBeGreaterThanOrEqual(1);
      await page.goto((await cand.getAttribute("data-href"))!, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("lista-total")).toHaveText(String(nCand));
    });

    test(`${largura}px — um número-herói, listas com divisor fino, nada de gradiente nem bloco colorido`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      // Período novo: os números da home ficam guardados 5 minutos por período; um período nunca usado lê na hora.
      const de = new Date(Date.now() - (40 + Math.floor(Math.random() * 300)) * 86_400_000).toISOString().slice(0, 10);
      await page.goto(`/admin?periodo=custom&de=${de}&ate=${new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)}`, { waitUntil: "domcontentloaded" });
      const heroi = page.locator('[data-testid="admin-heroi"]');
      await expect(heroi).toHaveCount(1, { timeout: 25_000 });
      await expect(page.locator('main [data-testid="numero-heroi"]')).toHaveCount(0);
      const link = heroi.locator("[data-href]");
      const valor = Number((await link.innerText()).replace(/\D/g, ""));
      const tamanho = await link.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(tamanho).toBeLessThanOrEqual(28);

      // "Agora" em lista com divisor fino (sem cartão) e todo número da home com link.
      await expect(page.getByTestId("home-agora")).toHaveJSProperty("tagName", "DL");
      expect(await page.locator("main [data-indicador] [data-valor]:not([data-href]), main [data-agora] [data-valor]:not([data-href])").count()).toBe(0);

      // Nenhum gradiente e nenhum fundo colorido (só branco / superfície do sistema) no conteúdo.
      const fundos = await page.locator("main").evaluate((m) => {
        const ruins: string[] = [];
        for (const el of Array.from(m.querySelectorAll<HTMLElement>("*"))) {
          const cs = getComputedStyle(el);
          if (cs.backgroundImage.includes("gradient")) ruins.push(`${el.tagName} gradiente`);
          const [r, g, b, a] = (cs.backgroundColor.match(/[\d.]+/g) ?? ["0", "0", "0", "0"]).map(Number);
          const saturado = Math.max(r, g, b) - Math.min(r, g, b) > 40;
          if ((a ?? 1) > 0.05 && saturado && !el.closest("button, a, [role=switch], nav, [data-visual='muda']")) ruins.push(`${el.tagName}.${String(el.className).slice(0, 60)} ${cs.backgroundColor}`);
        }
        return ruins;
      });
      expect(fundos).toEqual([]);
      await semRolagemLateral(page);

      await link.click();
      await expect(page.getByTestId("lista-total")).toHaveText(String(valor), { timeout: 20_000 });
    });
  }
});
