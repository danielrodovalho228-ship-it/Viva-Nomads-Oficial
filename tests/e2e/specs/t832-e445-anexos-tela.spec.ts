import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T832 — E445 item 5 (tela, Pista A; backend da Pista B em #2387/0288). Morador e proprietário, 390 e 1280.
  - Clipe ao lado do campo → prévia ANTES de enviar (foto em miniatura; PDF com tamanho) com "Enviar anexo"/"Cancelar".
  - Foto é regravada em WebP no navegador: o arquivo guardado é image/webp (sem EXIF, sem localização).
  - Na conversa: a foto aparece na bolha (abre pela rota do servidor, URL assinada) e o PDF como "Abrir PDF".
  - A outra parte vê o anexo; uma terceira conta não consegue abri-lo (404).
  - Arquivo grande demais ou de outro tipo: aviso na tela, nada enviado.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t832.${sufixo}@lab.vivanomads.test`, nome: "Dora Anexo", role: "owner" as const };
const inq = { email: `inq.t832.${sufixo}@lab.vivanomads.test`, nome: "Iara Anexo", role: "tenant" as const };
const intruso = { email: `out.t832.${sufixo}@lab.vivanomads.test`, nome: "Otto Fora", role: "tenant" as const };
const ids: Record<string, string> = {};

// PNG 4x4 válido (captura de tela) e um PDF mínimo (os primeiros bytes valem para o servidor).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAHklEQVR4nHTHsQkAAAwCQQnZf+W3Emy87h5QnMqOAQAA///IsZrzAAAABklEQVQDAJcKAwi+lOxUAAAAAElFTkSuQmCC", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

async function anexosDoInq() {
  const { data } = await adm().from("mensagens_anexos").select("id, mime, message_id").eq("sender_id", ids.inq).order("created_at");
  return (data ?? []) as { id: string; mime: string; message_id: string }[];
}

async function abrir(page: Page) {
  await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
  const conversa = page.getByRole("button", { name: /Studio do anexo/ }).first();
  await expect(conversa).toBeVisible({ timeout: 30_000 });
  await conversa.click();
  await expect(page.getByTestId("mensagem-campo")).toBeVisible();
}

test.describe("T832 — E445 item 5: anexos na conversa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.intruso = await criarConta(intruso, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do anexo ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Pode mandar os documentos por aqui.", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    const { data } = await adm().from("mensagens_anexos").select("caminho").eq("conversation_id", conversationId(ids.inq, ids.dono, ids.imovel));
    const caminhos = ((data ?? []) as { caminho: string }[]).map((d) => d.caminho);
    if (caminhos.length) await adm().storage.from("mensagens-anexos").remove(caminhos);
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq, ids.intruso]);
  });

  for (const w of [390, 1280] as const) {
    test(`${w}: prévia, envio da foto (sem EXIF) e do PDF, a outra parte vê e um terceiro não abre`, async ({ browser }) => {
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrir(p);
      const antes = (await anexosDoInq()).length;
      await expect(p.getByTestId("anexo-botao")).toBeVisible();

      // Tipo fora: aviso, nada enviado.
      await p.getByTestId("anexo-entrada").setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("oi") });
      await expect(p.getByTestId("anexo-erro")).toHaveText("Envie uma foto (JPG, PNG ou WebP) ou um PDF.");
      await expect(p.getByTestId("anexo-previa")).toHaveCount(0);

      // Foto: prévia antes de enviar; Cancelar não envia.
      await p.getByTestId("anexo-entrada").setInputFiles({ name: "casa-da-dora.png", mimeType: "image/png", buffer: PNG });
      await expect(p.getByTestId("anexo-previa")).toContainText("sem dados de localização");
      await expect(p.getByTestId("anexo-previa-foto")).toBeVisible();
      expect(await p.evaluate((l) => document.documentElement.scrollWidth - l, w)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `tests/laboratorio/saida/t832-previa-${w}.png` });
      await p.getByRole("button", { name: "Cancelar" }).click();
      await expect(p.getByTestId("anexo-previa")).toHaveCount(0);
      expect((await anexosDoInq()).length).toBe(antes);

      // Foto enviada: guardada como WebP (regravada no navegador: sem EXIF) e mostrada na bolha.
      await p.getByTestId("anexo-entrada").setInputFiles({ name: "casa-da-dora.png", mimeType: "image/png", buffer: PNG });
      await p.getByTestId("anexo-enviar").click();
      await expect(p.getByTestId("anexo-previa")).toHaveCount(0, { timeout: 30_000 });
      await expect.poll(async () => (await anexosDoInq()).length, { timeout: 20_000 }).toBe(antes + 1);
      const foto = (await anexosDoInq()).at(-1)!;
      expect(foto.mime).toBe("image/webp");
      const bolhaFoto = p.getByTestId("anexo-foto").last();
      await expect(bolhaFoto).toHaveAttribute("href", `/api/mensagens/anexo/${foto.id}`);
      await expect.poll(() => bolhaFoto.locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      // O nome do arquivo não vai para lugar nenhum.
      await expect(p.locator("main")).not.toContainText("casa-da-dora");

      // PDF: prévia com o tamanho, envio e "Abrir PDF".
      await p.getByTestId("anexo-entrada").setInputFiles({ name: "rg-da-iara.pdf", mimeType: "application/pdf", buffer: PDF });
      await expect(p.getByTestId("anexo-previa")).toContainText("PDF");
      await p.getByTestId("anexo-enviar").click();
      await expect.poll(async () => (await anexosDoInq()).length, { timeout: 20_000 }).toBe(antes + 2);
      const pdf = (await anexosDoInq()).at(-1)!;
      expect(pdf.mime).toBe("application/pdf");
      await expect(p.getByTestId("anexo-pdf").last()).toHaveAttribute("href", `/api/mensagens/anexo/${pdf.id}`);
      await expect(p.locator("main")).not.toContainText("rg-da-iara");
      expect(await p.evaluate((l) => document.documentElement.scrollWidth - l, w)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `tests/laboratorio/saida/t832-enviados-${w}.png` });
      await p.context().close();

      // A outra parte vê os dois anexos depois de recarregar.
      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrir(d);
      await expect(d.locator(`[data-testid="anexo-foto"][href="/api/mensagens/anexo/${foto.id}"]`)).toHaveCount(1, { timeout: 30_000 });
      await expect(d.locator(`[data-testid="anexo-pdf"][href="/api/mensagens/anexo/${pdf.id}"]`)).toHaveCount(1);
      const r = await d.request.get(`/api/mensagens/anexo/${pdf.id}`, { maxRedirects: 0 });
      expect(r.status()).toBe(302);
      await d.screenshot({ path: `tests/laboratorio/saida/t832-outra-parte-${w}.png` });
      await d.context().close();

      // Terceiro: não encontra o anexo.
      const o = await entrar(browser, intruso.email, senha);
      const r2 = await o.request.get(`/api/mensagens/anexo/${pdf.id}`, { maxRedirects: 0 });
      expect(r2.status()).toBe(404);
      await o.context().close();
    });
  }
});
