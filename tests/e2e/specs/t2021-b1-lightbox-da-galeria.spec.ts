import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2021 — Pista 3, lote 2, item B1 → E971 @E971 @B1 @E445 @ao-vivo-seguro — TRAVA NOMEADA (vermelha na main até a correção da
  Família 6). Esperado (coordenador, ORDEM-DUET-068 ponto 4): a foto da conversa aparece nos dois lados e abre no
  LIGHTBOX DO COMPONENTE DA GALERIA do imóvel (data-testid "galeria-lightbox", role dialog, foto "galeria-lightbox-foto",
  botão "Fechar") — sem abrir outra aba — e fecha pelo botão e pelo Esc. Hoje a foto abre em outra aba.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2021.${sufixo}@lab.vivanomads.test`, nome: "Dora Foto", role: "owner" as const };
const inq = { email: `inq.t2021.${sufixo}@lab.vivanomads.test`, nome: "Iara Foto", role: "tenant" as const };
const ids: Record<string, string> = {};
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAHklEQVR4nHTHsQkAAAwCQQnZf+W3Emy87h5QnMqOAQAA///IsZrzAAAABklEQVQDAJcKAwi+lOxUAAAAAElFTkSuQmCC", "base64");

async function abrir(p: Page) {
  await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: new RegExp(`Studio da foto ${sufixo}`) }).first().click();
}
async function lightboxAbreEFecha(p: Page) {
  let abas = 0;
  p.context().on("page", () => abas++);
  await p.getByTestId("anexo-foto").last().click();
  const caixa = p.getByTestId("galeria-lightbox");
  await expect(caixa).toBeVisible({ timeout: 15_000 });
  await expect(caixa).toHaveAttribute("role", "dialog");
  await expect.poll(() => caixa.getByTestId("galeria-lightbox-foto").locator("img").first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
  expect(abas, "a foto não abre outra aba").toBe(0);
  await caixa.getByRole("button", { name: "Fechar" }).click();
  await expect(caixa).toHaveCount(0);
  await p.getByTestId("anexo-foto").last().click();
  await expect(p.getByTestId("galeria-lightbox")).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(p.getByTestId("galeria-lightbox")).toHaveCount(0);
  expect(abas).toBe(0);
}

test.describe("T2021 — B1: foto da conversa no lightbox da galeria (trava da Família 6)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da foto ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Manda uma foto do documento.", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    const { data } = await adm().from("mensagens_anexos").select("caminho").eq("sender_id", ids.inq ?? "");
    const caminhos = ((data ?? []) as { caminho: string }[]).map((x) => x.caminho);
    if (caminhos.length) await adm().storage.from("mensagens-anexos").remove(caminhos);
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — quem envia e quem recebe abrem e fecham a foto no lightbox da galeria`, async ({ browser }) => {
      const i = await entrar(browser, inq.email, senha);
      await i.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(i);
      if (largura === 390) {
        await i.getByTestId("anexo-entrada").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
        await i.getByTestId("anexo-enviar").click();
        await expect(i.getByTestId("anexo-previa")).toHaveCount(0, { timeout: 30_000 });
      }
      await expect(i.getByTestId("anexo-foto").last()).toBeVisible({ timeout: 20_000 });
      await lightboxAbreEFecha(i);
      await i.context().close();

      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(d);
      await expect(d.getByTestId("anexo-foto").last()).toBeVisible({ timeout: 20_000 });
      await lightboxAbreEFecha(d);
      await d.context().close();
    });
  }
});
