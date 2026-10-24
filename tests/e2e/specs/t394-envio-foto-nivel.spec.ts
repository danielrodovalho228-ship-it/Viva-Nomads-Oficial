import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T394 — E47-A-CORRECAO: "Enviar a foto" da prova de nível nunca derruba a página.
   1. Rede caindo no meio do envio: a linha do item mostra "Não foi possível enviar a foto. Confira a conexão e toque
      para tentar de novo." e o botão "Tentar de novo"; a página segue viva. Com a rede de volta, tentar de novo envia.
   2. Arquivo acima de 8 MB: "Cada foto deve ter no máximo 8 MB." na linha, sem enviar nada e sem sair da tela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.envio.${sufixo}@lab.vivanomads.test`, nome: "Elis Envio", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const ITEM = "cozinha_microondas";

test.describe("T394 — envio de foto da prova de nível", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Envio ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. rede caindo: mensagem na linha, página viva, tentar de novo envia", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.message));
    await page.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(`nivel-item-${ITEM}`)).toBeVisible({ timeout: 30_000 });
    await page.route("**/api/upload/foto", (r) => r.abort("internetdisconnected"));
    await page.getByTestId(`nivel-foto-${ITEM}`).setInputFiles({ name: "micro.png", mimeType: "image/png", buffer: pngDeTeste(2) });
    await expect(page.getByTestId(`nivel-msg-${ITEM}`)).toHaveText("Não foi possível enviar a foto. Confira a conexão e toque para tentar de novo.", { timeout: 20_000 });
    await expect(page.getByTestId("nivel-itens")).toBeVisible();
    await expect(page.getByTestId(`nivel-tentar-${ITEM}`)).toBeVisible();
    await page.screenshot({ path: "tests/laboratorio/saida/t394-1-rede-caiu.png", fullPage: true });
    await page.unroute("**/api/upload/foto");
    await page.getByTestId(`nivel-tentar-${ITEM}`).click();
    await expect(page.getByTestId(`nivel-msg-${ITEM}`)).not.toContainText("Não foi possível enviar", { timeout: 30_000 });
    await expect(page.getByTestId(`nivel-item-${ITEM}`)).toHaveAttribute("data-declarado", "1", { timeout: 30_000 });
    expect(erros, "nenhum erro solto na página").toEqual([]);
    await page.context().close();
  });

  test("2. acima de 8 MB: a frase do limite, sem enviar e sem sair da tela", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    let enviou = false;
    await page.route("**/api/upload/foto", (r) => {
      enviou = true;
      return r.continue();
    });
    const item = "mesa_jantar_todos";
    await page.getByTestId(`nivel-foto-${item}`).setInputFiles({ name: "grande.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(8 * 1024 * 1024 + 10, 1) });
    await expect(page.getByTestId(`nivel-msg-${item}`)).toHaveText("Cada foto deve ter no máximo 8 MB.", { timeout: 20_000 });
    await expect(page.getByTestId("nivel-itens")).toBeVisible();
    expect(enviou).toBe(false);
    await page.context().close();
  });
});
