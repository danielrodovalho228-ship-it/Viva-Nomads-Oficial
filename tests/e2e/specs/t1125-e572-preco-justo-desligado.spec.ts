import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1125 — E572 (#2535, 04/11): o filtro "Preço justo" da busca e o indicador do admin ficam ATRÁS da chave do selo
 * (NEXT_PUBLIC_PRECO_JUSTO_COMPARADOR, família E399-C), que está DESLIGADA em produção e no laboratório. Entrou com o
 * e572-filtro-preco-justo.test.ts (a lógica com a chave ligada); aqui é a tela com a chave como ela está, 390 e 1280:
 *   1. /buscar numa cidade só do teste (2 anúncios ativos): `?precojusto=1` na URL não tira ninguém — o "Aplicar" da
 *      folha de filtros entrega o MESMO total com e sem o parâmetro, e a folha não oferece "Preço justo";
 *   2. Admin → Qualidade: o painel qualidade-preco-justo diz que a chave está desligada e nada é lido.
 * Se a chave for ligada um dia, esta spec se pula (o comportamento ligado fica com o teste de unidade).
 */
const CHAVE_LIGADA = process.env.NEXT_PUBLIC_PRECO_JUSTO_COMPARADOR === "on";
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade Preco Justo ${sufixo}`;
const dono = { email: `dono.t1125.${sufixo}@lab.vivanomads.test`, nome: "Leo Preço Justo", role: "owner" as const };
const ids: { dono?: string; a?: string; b?: string } = {};

/** Abre a folha "Mais filtros" (como a t350) e devolve o total que o "Aplicar" entrega. */
async function totalDaFolha(page: Page, url: string): Promise<number> {
  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(page.getByTestId("painel-filtros")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId("aplicar-filtros")).toHaveAttribute("data-total", /\d+/, { timeout: 15_000 });
  return Number(await page.getByTestId("aplicar-filtros").getAttribute("data-total"));
}

test.describe("T1125 — E572: com a chave do selo desligada, o filtro \"Preço justo\" não tira ninguém e o admin diz que está desligado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(CHAVE_LIGADA, "A chave do Preço justo está ligada: o comportamento ligado fica com o teste de unidade.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarImovelPronto(ids.dono, `Studio A preço justo ${sufixo}`, { ativo: true, preco: 2400 });
    ids.b = await criarImovelPronto(ids.dono, `Studio B preço justo ${sufixo}`, { ativo: true, preco: 2800 });
    const { error } = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.a, ids.b]);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`busca: ?precojusto=1 entrega o mesmo total e a folha não oferece "Preço justo" (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        const base = `/buscar?local=${encodeURIComponent(CIDADE)}`;
        const sem = await totalDaFolha(page, base);
        expect(sem, "os 2 anúncios da cidade do teste").toBe(2);
        const com = await totalDaFolha(page, `${base}&precojusto=1`);
        expect(com, "com a chave desligada o filtro não tira ninguém").toBe(sem);
        await expect(page.getByTestId("painel-filtros")).not.toContainText("Preço justo");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }

  test("admin → Qualidade: o indicador do Preço justo diz que a chave está desligada", async ({ browser }) => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    for (const w of [1280, 390] as const) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        await page.goto("/admin/qualidade", { waitUntil: "domcontentloaded" });
        const painel = page.getByTestId("qualidade-preco-justo");
        await expect(painel).toBeVisible({ timeout: 30_000 });
        await expect(painel).toContainText("Chave do Preço justo desligada: nada é lido.");
        await expect(painel).toHaveAttribute("data-valor", "");
      } finally {
        await ctx.close();
      }
    }
  });
});
