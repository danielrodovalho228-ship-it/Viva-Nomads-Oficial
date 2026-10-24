import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, definirPlano, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { celularComCamera } from "../fixtures/camera";

/*
  T399 — E100 e E70 (rodada de QA de 24/10). Só no laboratório.
   1. E100, computador (1280 px, sem câmera): a página do nível aberta DIRETO mostra "Fotografar pelo celular"
      ativo em até 1 s (antes ficava cinza); pelo link de refazer (?fotografar=), o QR abre.
   2. E100, celular (390 px, câmera falsa): aberta direto, "Fotografar agora" ativo em até 1 s e a câmera abre;
      pelo link de refazer, a câmera abre sozinha.
   3. E70: Conta › Pagamentos mostra "Como você recebe (proprietário)" para quem tem anúncio (rascunho, pausado ou
      ativo) e não mostra para a conta só de morador.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e100.${sufixo}@lab.vivanomads.test`, nome: "Edu Cem", role: "owner" as const };
const morador = { email: `mor.e70.${sufixo}@lab.vivanomads.test`, nome: "Mia Setenta", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string } = {};
const ITEM = "cozinha_microondas";

test.describe("T399 — E100 (câmera na vista inicial) e E70 (bloco do dono em Pagamentos)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    await definirPlano(ids.dono, "pro");
    ids.imovel = await criarImovelPronto(ids.dono, `Studio E100 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.morador]);
  });

  test("1. computador sem câmera: aberta direto, 'Fotografar pelo celular' ativo; pelo link de refazer, o QR abre", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    const botao = page.getByTestId(`nivel-foto-${ITEM}-botao`);
    await expect(botao).toBeVisible({ timeout: 30_000 });
    // Hidratada a página, o botão decide em até 1 s (antes: cinza para sempre na vista inicial).
    await expect(botao).toBeEnabled({ timeout: 2_000 });
    await expect(botao).toHaveText("Fotografar pelo celular");
    await expect(botao).toHaveAttribute("data-modo", "computador");
    await page.screenshot({ path: "tests/laboratorio/saida/t399-1-direto-1280.png", fullPage: false });
    await page.goto(`/dashboard/imoveis/${ids.imovel}/nivel?fotografar=${ITEM}#nivel-itens`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(`prova-celular-${ITEM}`).getByTestId("prova-celular-qr")).toBeVisible({ timeout: 30_000 });
    await page.context().close();
  });

  test("2. celular com câmera: aberta direto, 'Fotografar agora' ativo e a câmera abre; pelo link de refazer, abre sozinha", async ({}, info) => {
    test.skip(info.project.name !== "chromium", "o celular com câmera sai dentro do teste");
    const cel = await celularComCamera({ email: dono.email, senha });
    try {
      await cel.page.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      const botao = cel.page.getByTestId(`nivel-foto-${ITEM}-botao`);
      await expect(botao).toBeVisible({ timeout: 30_000 });
      await expect(botao).toBeEnabled({ timeout: 2_000 });
      await expect(botao).toHaveText("Fotografar agora");
      await botao.click();
      await expect(cel.page.getByTestId("camera-prova")).toHaveAttribute("data-etapa", "ao_vivo", { timeout: 20_000 });
      await cel.page.getByTestId("camera-fechar").click();
      await cel.page.goto(`/dashboard/imoveis/${ids.imovel}/nivel?fotografar=${ITEM}#nivel-itens`, { waitUntil: "domcontentloaded" });
      await expect(cel.page.getByTestId("camera-prova")).toHaveAttribute("data-etapa", "ao_vivo", { timeout: 30_000 });
      await cel.page.screenshot({ path: "tests/laboratorio/saida/t399-2-refazer-390.png", fullPage: false });
    } finally {
      await cel.fechar();
    }
  });

  test("3. Pagamentos: o bloco do dono aparece com anúncio (rascunho, pausado, ativo); não para a conta só de morador", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    for (const status of ["draft", "paused", "active"] as const) {
      const { error } = await adm().from("properties").update({ status }).eq("id", ids.imovel!);
      if (error) throw error;
      await page.goto("/dashboard/conta/pagamentos", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("conta-pagamentos")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("conta-pix"), `anúncio ${status}`).toBeVisible({ timeout: 20_000 });
    }
    await page.screenshot({ path: "tests/laboratorio/saida/t399-3-pagamentos-dono-390.png", fullPage: true });
    await page.context().close();

    const mor = await entrar(browser, morador.email, senha);
    await mor.goto("/dashboard/conta/pagamentos", { waitUntil: "domcontentloaded" });
    await expect(mor.getByTestId("conta-pagamentos")).toBeVisible({ timeout: 30_000 });
    await mor.waitForTimeout(2_000);
    await expect(mor.getByTestId("conta-pix")).toHaveCount(0);
    await mor.context().close();
  });
});
