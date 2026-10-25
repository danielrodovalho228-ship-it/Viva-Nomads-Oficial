import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso, type PassoCadastro } from "../fixtures/cadastro";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T535 — E153, guarda permanente da Pista C: o pedido de envio do documento do imóvel aparece em UM lugar só. Num
  rascunho sem documento, conta os pedidos de envio (botão "Enviar documento" do cartão, o "Enviar documento" do
  resumo da Revisão e o campo de envio da /qualificar) no Passo 3, no Passo 10 e em /qualificar?imovel=…; a soma tem
  de ser 1. A 1280 px. As contagens vão nas anotações do teste.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t535.${sufixo}@lab.vivanomads.test`, nome: "Dora Documento", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};
const PEDIDOS = [
  '[data-testid="documento-enviar"]',
  '[data-testid="revisar-documento-enviar"]',
  'input[type="file"][aria-label^="Enviar documentação do imóvel"]',
].join(", ");

async function contar(page: Page): Promise<number> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return page.locator(PEDIDOS).evaluateAll((els) =>
    els.filter((e) => {
      const r = (e as HTMLElement).getBoundingClientRect();
      // O input de arquivo da /qualificar é sr-only (1 px): conta se está no documento e não escondido.
      return getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none" && (r.width > 0 || r.height > 0);
    }).length,
  );
}

test.describe("T535 — E153: pedido do documento em um lugar só", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio t535 ${sufixo}`, {
      street: "Avenida João Naves de Ávila",
      numero: "2121",
      neighborhood: "Santa Mônica",
      city: "Uberlândia",
      uf: "MG",
      cep: "38408-100",
    });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("a 1280 px: Passo 3 + Passo 10 + /qualificar = 1 pedido de envio", async ({ browser }) => {
    // E153 (Pista A): o pedido aparece em dois lugares — o "Enviar documento" da Revisão e o envio da /qualificar
    // (lab-crítico 40207606596: {"endereco":0,"revisao":1,"qualificar":1}, total 2). Quem corrigir tira este test.fail.
    test.fail(true, "E153: o pedido do documento aparece na Revisão e de novo na /qualificar");
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    const contagem: Record<string, number> = {};
    for (const passo of ["endereco", "revisao"] as PassoCadastro[]) {
      await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${passo}`, { waitUntil: "domcontentloaded" });
      await noPasso(page, passo, 30_000);
      contagem[passo] = await contar(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t535-${passo}-1280.png`, fullPage: true });
    }
    await page.goto(`/qualificar?imovel=${ids.rascunho}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
    contagem.qualificar = await contar(page);
    await page.screenshot({ path: "tests/laboratorio/saida/t535-qualificar-1280.png", fullPage: true });
    const total = Object.values(contagem).reduce((a, b) => a + b, 0);
    test.info().annotations.push({ type: "contagem", description: JSON.stringify(contagem) });
    console.log(`t535 contagem ${JSON.stringify(contagem)} total=${total}`);
    expect(total, `pedidos de envio do documento: ${JSON.stringify(contagem)}`).toBe(1);
    await page.context().close();
  });
});
