import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, adm, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T981 — #2154, varredura de erros rodada 17, achado 88: na candidatura, o bloco do comprovante de vínculo (triagem
 * do morador, chave TRIAGEM_VINCULO_ATIVA ligada só neste navegador pelo cookie do laboratório, como na t348) NÃO
 * pede o envio de novo quando a leitura falha. Antes, a falha virava "comprovante não enviado" (data-estado="nenhum",
 * com o campo de arquivo); agora meuVinculo() lança e a tela esconde o bloco. 390 e 1280:
 *   1. controle: sem falha, o bloco aparece em "nenhum" com o campo de arquivo (a massa é real);
 *   2. com a resposta de meuVinculo() trocada por 500 (só ela: a resposta que traz "noDegrau"), a página abre, o bloco
 *      não aparece e nada pede o envio do comprovante.
 * Os achados 86 (contrato da equipe) e 87 (detalhe do pedido de serviço) são leituras na renderização do servidor:
 * não há como o navegador simular a falha; ficam com o achado86-88.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t981.${sufixo}@lab.vivanomads.test`, nome: "Dora Triagem", role: "owner" as const };
const mor = { email: `mor.t981.${sufixo}@lab.vivanomads.test`, nome: `Mateus Triagem ${sufixo}`, role: "tenant" as const };
const ids: { dono?: string; mor?: string; imovel?: string; lead?: string } = {};
const MARCA = "noDegrau";

async function abrir(browser: Browser, largura: number): Promise<Page> {
  const page = await entrar(browser, mor.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.context().addCookies([{ name: "vn_lab_triagem", value: "1", url: new URL(page.url()).origin }]);
  return page;
}

/** Troca por 500 só a resposta da ação do servidor que traz a marca (a de meuVinculo); as outras passam. */
async function falharLeitura(page: Page, vistas: string[]) {
  await page.route("**/dashboard/candidaturas**", async (r) => {
    if (r.request().method() !== "POST" || !r.request().headers()["next-action"]) return r.continue().catch(() => {});
    try {
      const resp = await r.fetch();
      const corpo = await resp.text();
      if (corpo.includes(MARCA)) {
        vistas.push("falhou");
        return await r.fulfill({ status: 500, body: "falha simulada (t981)" });
      }
      return await r.fulfill({ response: resp, body: corpo });
    } catch {
      /* a página navegou ou a rota já foi resolvida */
    }
  });
}

test.describe("T981 — #2154 achado 88: falha na leitura do comprovante não pede o envio de novo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio triagem t981 ${sufixo}`, { ativo: true, preco: 2600 });
    ids.lead = await criarLead(ids.dono, ids.mor, ids.imovel, true);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.mor]);
  });

  for (const w of [390, 1280] as const) {
    test(`controle: o bloco aparece em "nenhum" com o campo de arquivo (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      await page.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Minhas candidaturas" })).toBeVisible({ timeout: 30_000 });
      const bloco = page.getByTestId("triagem-vinculo");
      await expect(bloco).toHaveAttribute("data-estado", "nenhum", { timeout: 30_000 });
      await expect(bloco.getByTestId("triagem-arquivo")).toHaveCount(1);
      await page.context().close();
    });

    test(`leitura que falha: sem o bloco e sem pedir o envio (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      const vistas: string[] = [];
      await falharLeitura(page, vistas);
      await page.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Minhas candidaturas" })).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => vistas.length, { timeout: 30_000, message: "a leitura do comprovante precisa ter sido interceptada" }).toBeGreaterThan(0);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("triagem-vinculo")).toHaveCount(0);
      await expect(page.getByTestId("triagem-arquivo")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Minhas candidaturas" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.unrouteAll({ behavior: "wait" });
      await page.context().close();
    });
  }
});
