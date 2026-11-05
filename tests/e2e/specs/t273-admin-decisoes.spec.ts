import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T273 — Prompt 46 (D5), o admin na anatomia "decisões primeiro", a 390 e 1280 px:
   ADMIN-4: as decisões moram no topo de /admin/pendencias (h2, abaixo do título da página); a inicial mostra as 5
   primeiras em "Precisa da sua atenção". Os números do período moram em /admin/funil, sem número-herói.
   1. /admin/pendencias abre com "Hoje você tem N decisões"; N = a soma das linhas; cada linha tem o número (link) e o botão
      da decisão (secundário — nenhum primário nas decisões) que levam à mesma tela do admin;
   2. o spec cria um pedido de encerramento aberto e uma candidatura parada há 3 dias: as duas linhas aparecem e a
      lista aberta conta o mesmo (encerramentos: linhas não concluídas; candidaturas: lista-total);
   3. /admin/funil: nenhum número-herói; os indicadores em listas com divisor fino, todo número com link;
   4. nada de gradiente nem fundo colorido nos números e selos; sem rolagem lateral.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t273.${sufixo}@lab.vivanomads.test`, nome: "Dalva Decide Prado", role: "owner" as const };
const inq = { email: `inq.t273.${sufixo}@lab.vivanomads.test`, nome: "Ivo Decide Prado", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T273 — admin: decisões primeiro", () => {
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
    // E330/E474 (01–05/11): a Central redesenhou o topo — "N pendências esperando ação" (o título conta o mesmo que a
    // fila), os atalhos das filas da Central (número + Abrir, secundário) e as decisões de outras telas UMA vez, como
    // itens de "Todas as pendências" com o botão que leva à decisão. O teste segue o desenho atual (antes: "Hoje você
    // tem N decisões" com links para as outras telas, testid admin-decisoes).
    test(`${largura}px — "N pendências esperando ação": nenhum primário no topo; encerramento e candidatura levam à decisão`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/admin/pendencias", { waitUntil: "domcontentloaded" });
      const secao = page.getByTestId("central-decisoes");
      const h2 = secao.getByRole("heading", { level: 2 });
      await expect(h2).toHaveText(/^\d+ pendências? esperando ação$/, { timeout: 25_000 });
      expect(Number((await h2.innerText()).match(/\d+/)![0]), "o encerramento e a candidatura semeados contam").toBeGreaterThanOrEqual(2);
      expect(Number(await secao.getAttribute("data-total"))).toBe(Number((await h2.innerText()).match(/\d+/)![0]));
      await expect(secao.locator("a.bg-forest, button.bg-forest"), "os atalhos do topo são secundários").toHaveCount(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t273-decisoes-${largura}.png`, fullPage: false });

      // Encerramento aberto: um item na fila, com o botão para a tela dos encerramentos, onde o contrato está.
      const enc = page.locator('[data-testid="central-linha-decisao"][data-decisao="encerramentos"]');
      await expect(enc).toHaveCount(1);
      const hrefEnc = await enc.getByRole("link").first().getAttribute("href");
      expect(hrefEnc).toMatch(/^\/admin\/contratos\/encerramentos/);
      await page.goto(hrefEnc!, { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-contrato="${ids.contrato}"]`)).toHaveCount(1, { timeout: 30_000 });

      // Candidatura parada há 3 dias: um item na fila, com o botão para a lista filtrada (não vazia).
      await page.goto("/admin/pendencias", { waitUntil: "domcontentloaded" });
      const cand = page.locator('[data-testid="central-linha-decisao"][data-decisao="candidaturas_sem_resposta_48h"]');
      await expect(cand).toHaveCount(1, { timeout: 25_000 });
      const hrefCand = await cand.getByRole("link").first().getAttribute("href");
      expect(hrefCand).toMatch(/^\/admin/);
      await page.goto(hrefCand!, { waitUntil: "domcontentloaded" });
      expect(Number(await page.getByTestId("lista-total").innerText({ timeout: 25_000 }))).toBeGreaterThanOrEqual(1);
    });

    test(`${largura}px — Funil e indicadores: sem número-herói, listas com divisor fino, nada de gradiente nem bloco colorido`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      // Período novo: os números ficam guardados 5 minutos por período; um período nunca usado lê na hora.
      const de = new Date(Date.now() - (40 + Math.floor(Math.random() * 300)) * 86_400_000).toISOString().slice(0, 10);
      await page.goto(`/admin/funil?periodo=custom&de=${de}&ate=${new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("funil-indicadores")).toBeVisible({ timeout: 25_000 });
      await expect(page.locator('main [data-testid="admin-heroi"], main [data-testid="numero-heroi"]')).toHaveCount(0);
      const link = page.locator("[data-indicador] [data-href]").first();
      expect(await page.locator("main [data-indicador] [data-valor]:not([data-href])").count()).toBe(0);

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

      // O número abre a lista que ele conta.
      const destino = await link.getAttribute("href");
      expect(destino).toMatch(/^\/admin\//);
    });
  }
});
