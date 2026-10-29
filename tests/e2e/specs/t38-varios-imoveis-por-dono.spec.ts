import { test, expect, type Page } from "@playwright/test";
import {
  NO_LABORATORIO,
  apagarContas,
  contarAtivos,
  criarConta,
  criarImovelPronto,
  definirPlano,
  entrar,
  novaSenha,
  novoSufixo,
  publicarPeloEditor,
  statusDoImovel,
} from "../fixtures/laboratorio";

/**
 * T38 — VÁRIOS IMÓVEIS POR DONO, modelo vigente (E233-A). A cobrança é só a taxa de serviço por faixas; o limite de
 * anúncios dos planos antigos saiu. Conta NOVA de proprietário SEM assinatura (Gratuito), imóveis prontos (8 fotos,
 * descrição, Caução, documento aprovado):
 *  1. o 2º anúncio publica pelo editor — sem "Vaga no seu plano", sem "seu plano permite";
 *  2. o 5º publica;
 *  3. o 21º publica; Meus imóveis e o painel não mostram faixa de limite nem "mude de plano" (390 e 1280 px).
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.varios.${sufixo}@lab.vivanomads.test`, nome: "Vera Varios Imoveis", role: "owner" as const };
const titulo = (n: number) => `Studio ${n} do teste de vários imóveis ${sufixo}`;
const ids: { dono?: string; rascunho: Record<number, string> } = { rascunho: {} };
const PLANO_ANTIGO = /Vaga no seu plano|seu plano permite|mude de plano|mudar de plano/i;

/** Publicados direto pelo laboratório (como se o dono já os tivesse no ar), em lotes. */
async function noAr(de: number, ate: number) {
  for (let n = de; n <= ate; n += 5) {
    await Promise.all(Array.from({ length: Math.min(5, ate - n + 1) }, (_, i) => criarImovelPronto(ids.dono!, titulo(n + i), { ativo: true })));
  }
}

async function publicaSemLimite(page: Page, n: number) {
  const id = ids.rascunho[n];
  await page.goto(`/dashboard/imoveis/${id}/editar`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("prontidao")).toContainText("Anúncio", { timeout: 20_000 });
  await expect(page.getByText(PLANO_ANTIGO)).toHaveCount(0);
  await publicarPeloEditor(page, id);
  await expect.poll(() => statusDoImovel(id), { timeout: 30_000 }).toBe("active");
  expect(await contarAtivos(ids.dono!)).toBe(n);
}

test.describe("T38 — Vários imóveis por dono, sem limite de plano (E233-A)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await definirPlano(ids.dono, null); // sem assinatura: o antigo "Gratuito, limite 1"
    await criarImovelPronto(ids.dono, titulo(1), { ativo: true });
    for (const n of [2, 5, 21]) ids.rascunho[n] = await criarImovelPronto(ids.dono, titulo(n));
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("sem assinatura, o 2º anúncio publica (sem vaga no plano)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await publicaSemLimite(page, 2);
    await page.screenshot({ path: `${SAIDA}/t38-segundo-publicado-390.png`, fullPage: true });
    await page.context().close();
  });

  test("o 5º publica", async ({ browser }) => {
    await noAr(3, 4);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await publicaSemLimite(page, 5);
    await page.context().close();
  });

  test("o 21º publica; Meus imóveis e o painel sem faixa de limite nem 'mude de plano'", async ({ browser }) => {
    await noAr(6, 20);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await publicaSemLimite(page, 21);
    for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
      await page.setViewportSize({ width: largura, height: altura });
      for (const rota of ["/dashboard/imoveis", "/dashboard"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        await expect(page.getByTestId("bloco-limite")).toHaveCount(0);
        await expect(page.getByText(PLANO_ANTIGO)).toHaveCount(0);
      }
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(titulo(21)).first()).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: `${SAIDA}/t38-vinte-e-um-${largura}.png` });
    }
    await page.context().close();
  });
});
