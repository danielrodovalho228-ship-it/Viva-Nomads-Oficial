import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1073 — E445 item 5, tela (#2397, 04/11): o que a t832 não cobre. Pela tela real, 390 e 1280, moradora e dono:
 *   1. o envio do anexo FALHA (simulada: a rota responde 500 com a mensagem do servidor; depois a rede cai) → o aviso
 *      aparece (a mensagem do servidor; sem resposta, "Não foi possível enviar o anexo agora. Tente de novo."), a prévia
 *      continua com "Enviar anexo", nenhuma bolha nova e nada gravado — falha não vira "enviado";
 *   2. com a rota de volta, "Enviar anexo" de novo envia: a prévia some e a bolha mostra "Abrir PDF";
 *   3. recarregar a página: o anexo continua na bolha (vem do servidor, listConversations), para a moradora e para o dono.
 * Prévia, foto sem localização, tipo errado e conta de fora ficam com a t832; as regras puras com o anexo-tela.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1073.${sufixo}@lab.vivanomads.test`, nome: "Fausto Falha Lopes", role: "owner" as const };
const inq = { email: `inq.t1073.${sufixo}@lab.vivanomads.test`, nome: "Rita Reenvio Alves", role: "tenant" as const };
const TITULO = `Studio da falha t1073 ${sufixo}`;
const ids: Record<string, string> = {};
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const ERRO_SERVIDOR = "Não foi possível salvar o anexo agora.";
const ERRO_REDE = "Não foi possível enviar o anexo agora. Tente de novo.";

const conversa = () => conversationId(ids.inq, ids.dono, ids.imovel);
const anexosGravados = async () =>
  ((await adm().from("mensagens_anexos").select("id").eq("conversation_id", conversa())).data ?? []) as { id: string }[];

async function abrir(page: Page) {
  await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
  const item = page.getByRole("button", { name: new RegExp(TITULO) }).first();
  await expect(item).toBeVisible({ timeout: 30_000 });
  await item.click();
  await expect(page.getByTestId("mensagem-campo")).toBeVisible();
}
const sobra = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("T1073 — E445: envio do anexo que falha não vira 'enviado'; o anexo fica na conversa ao recarregar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Pode mandar o comprovante por aqui.", conversa());
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    const { data } = await adm().from("mensagens_anexos").select("caminho").eq("conversation_id", conversa());
    const caminhos = ((data ?? []) as { caminho: string }[]).map((d) => d.caminho);
    if (caminhos.length) await adm().storage.from("mensagens-anexos").remove(caminhos);
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`falha no envio: aviso, prévia mantida, nada gravado; de novo envia; recarregar mantém a bolha (${w})`, async ({ browser }) => {
      const antes = (await anexosGravados()).length;
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrir(p);
      const pdfs = p.getByTestId("anexo-pdf");
      const bolhasAntes = await pdfs.count();

      // 1a. O servidor responde 500 com a mensagem dele.
      await p.route("**/api/mensagens/anexo", (r) =>
        r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: ERRO_SERVIDOR }) }) : r.fallback()
      );
      await p.getByTestId("anexo-entrada").setInputFiles({ name: "comprovante.pdf", mimeType: "application/pdf", buffer: PDF });
      const previa = p.getByTestId("anexo-previa");
      await expect(previa).toContainText("PDF");
      await p.getByTestId("anexo-enviar").click();
      await expect(p.getByTestId("anexo-erro")).toHaveText(ERRO_SERVIDOR, { timeout: 30_000 });
      await expect(previa, "a prévia continua para tentar de novo").toBeVisible();
      await expect(p.getByTestId("anexo-enviar")).toHaveText("Enviar anexo");
      await expect(pdfs, "nenhuma bolha inventada").toHaveCount(bolhasAntes);
      expect(await sobra(p)).toBeLessThanOrEqual(1);

      // 1b. A rede cai (sem resposta): o aviso padrão.
      await p.unrouteAll({ behavior: "wait" });
      await p.route("**/api/mensagens/anexo", (r) => (r.request().method() === "POST" ? r.abort("failed") : r.fallback()));
      await p.getByTestId("anexo-enviar").click();
      await expect(p.getByTestId("anexo-erro")).toHaveText(ERRO_REDE, { timeout: 30_000 });
      await expect(previa).toBeVisible();
      await expect(pdfs).toHaveCount(bolhasAntes);
      expect((await anexosGravados()).length, "a falha não grava anexo").toBe(antes);

      // 2. Rota de volta: o mesmo arquivo da prévia vai.
      await p.unrouteAll({ behavior: "wait" });
      await p.getByTestId("anexo-enviar").click();
      await expect(previa).toHaveCount(0, { timeout: 30_000 });
      await expect(p.getByTestId("anexo-erro")).toHaveCount(0);
      await expect(pdfs).toHaveCount(bolhasAntes + 1);
      const gravados = await anexosGravados();
      expect(gravados.length).toBe(antes + 1);
      const novo = (await adm().from("mensagens_anexos").select("id").eq("conversation_id", conversa()).order("created_at", { ascending: false }).limit(1).single()).data!.id as string;
      await expect(pdfs.last()).toHaveAttribute("href", `/api/mensagens/anexo/${novo}`);

      // 3. Recarregar: o anexo vem do servidor e continua na bolha.
      await abrir(p);
      await expect(pdfs).toHaveCount(bolhasAntes + 1, { timeout: 30_000 });
      await expect(pdfs.last()).toHaveAttribute("href", `/api/mensagens/anexo/${novo}`);
      await p.context().close();

      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrir(d);
      await expect(d.getByTestId("anexo-pdf").last()).toHaveAttribute("href", `/api/mensagens/anexo/${novo}`, { timeout: 30_000 });
      expect(await sobra(d)).toBeLessThanOrEqual(1);
      await d.context().close();
    });
  }
});
