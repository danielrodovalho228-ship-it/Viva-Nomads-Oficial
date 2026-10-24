import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { celularComCamera, fotografarEUsar } from "../fixtures/camera";

/*
  T394 — E47-A-CORRECAO: o envio da foto da prova de nível nunca derruba a página. FOTO-NA-HORA-B: a prova agora é a foto
  feita na hora pela câmera (sem arquivo), então os dois casos passam pela câmera do celular (câmera falsa do Chromium).
   1. Rede caindo no meio do envio: a câmera mostra "Não foi possível enviar a foto. Confira a conexão e toque em Usar
      esta foto de novo." e fica na prévia; a página segue viva. Com a rede de volta, "Usar esta foto" envia.
   2. Resposta da Vercel acima do limite (413, corpo em texto): a câmera mostra a frase de tentar de novo e volta para a
      imagem ao vivo; a página segue viva.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.envio.${sufixo}@lab.vivanomads.test`, nome: "Elis Envio", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const ITEM = "cozinha_microondas";

test.describe("T394 — envio da foto da prova de nível (câmera)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Envio ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. rede caindo: mensagem na câmera, página viva, 'Usar esta foto' de novo envia", async ({}, info) => {
    test.skip(info.project.name !== "chromium", "o celular com câmera sai dentro do teste");
    const cel = await celularComCamera({ email: dono.email, senha });
    const { page } = cel;
    try {
      const erros: string[] = [];
      page.on("pageerror", (e) => erros.push(e.message));
      await page.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(`nivel-item-${ITEM}`)).toBeVisible({ timeout: 30_000 });
      await page.getByTestId(`nivel-foto-${ITEM}-botao`).click();
      await page.route("**/api/upload/prova", (r) => r.abort("internetdisconnected"));
      await fotografarEUsar(page);
      await expect(page.getByTestId("camera-msg")).toHaveText("Não foi possível enviar a foto. Confira a conexão e toque em Usar esta foto de novo.", { timeout: 20_000 });
      await expect(page.getByTestId("camera-prova")).toHaveAttribute("data-etapa", "previa");
      await page.screenshot({ path: "tests/laboratorio/saida/t394-1-rede-caiu.png", fullPage: true });
      await page.unroute("**/api/upload/prova");
      await page.getByTestId("camera-usar").click();
      await expect(page.getByTestId(`nivel-msg-${ITEM}`)).toHaveText("Foto de Micro-ondas recebida. O item já conta enquanto a foto é analisada.", { timeout: 30_000 });
      await expect(page.getByTestId(`nivel-item-${ITEM}`)).toHaveAttribute("data-declarado", "1", { timeout: 30_000 });
      await expect(page.getByTestId("nivel-itens")).toBeVisible();
      expect(erros, "nenhum erro solto na página").toEqual([]);
    } finally {
      await cel.fechar();
    }
  });

  test("2. 413 da Vercel (corpo em texto): frase de tentar de novo, câmera ao vivo, página viva", async ({}, info) => {
    test.skip(info.project.name !== "chromium", "o celular com câmera sai dentro do teste");
    const cel = await celularComCamera({ email: dono.email, senha });
    const { page } = cel;
    try {
      const erros: string[] = [];
      page.on("pageerror", (e) => erros.push(e.message));
      await page.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      const item = "mesa_jantar_todos";
      await page.getByTestId(`nivel-foto-${item}-botao`).click({ timeout: 30_000 });
      await page.route("**/api/upload/prova", (r) => r.fulfill({ status: 413, contentType: "text/plain", body: "Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE" }));
      await fotografarEUsar(page);
      await expect(page.getByTestId("camera-msg")).toHaveText("Não foi possível enviar a foto. Fotografe de novo.", { timeout: 20_000 });
      await expect(page.getByTestId("camera-prova")).toHaveAttribute("data-etapa", "ao_vivo");
      await page.getByTestId("camera-fechar").click();
      await expect(page.getByTestId("nivel-itens")).toBeVisible();
      expect(erros, "nenhum erro solto na página").toEqual([]);
    } finally {
      await cel.fechar();
    }
  });
});
