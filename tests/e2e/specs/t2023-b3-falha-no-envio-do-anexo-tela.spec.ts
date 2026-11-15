import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2023 (tela) — Pista 3, lote 2, item B3 @E445 @ao-vivo-seguro. Cobertura NOMEADA do B3 inteiro (decisão do Gerente: os
  rascunhos t1071/t1073 citados no estudo nunca entraram na main). A parte do servidor está no unitário
  src/lib/messages/e445-t2023-falha-no-envio-do-anexo.test.ts (#3850).
  Regra: o envio de anexo que falha no meio deixa o ERRO VISÍVEL na prévia (a rede caída → "Não foi possível enviar o
  anexo agora. Tente de novo."; o servidor recusando → a mensagem dele), a prévia continua com "Enviar anexo" (o
  arquivo não se perde) e tentar de novo conclui — com UM anexo gravado, sem duplicar.
  Vermelho: pendente de laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2023.${sufixo}@lab.vivanomads.test`, nome: "Dora Falha", role: "owner" as const };
const inq = { email: `inq.t2023.${sufixo}@lab.vivanomads.test`, nome: "Igor Falha", role: "tenant" as const };
const ids: Record<string, string> = {};
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const anexos = async () => ((await adm().from("mensagens_anexos").select("id").eq("sender_id", ids.inq)).data ?? []).length;
const ROTA = "**/api/mensagens/anexo";

async function abrirComPdf(p: Page) {
  await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: new RegExp(`Studio da falha ${sufixo}`) }).first().click();
  await p.getByTestId("anexo-entrada").setInputFiles({ name: "comprovante.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(p.getByTestId("anexo-previa")).toContainText("PDF");
}

test.describe("T2023 — B3: falha no meio do envio do anexo, erro visível e tentar de novo @E445", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da falha ${sufixo}`, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Pode mandar o comprovante por aqui.", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    const { data } = await adm().from("mensagens_anexos").select("caminho").eq("sender_id", ids.inq ?? "");
    const caminhos = ((data ?? []) as { caminho: string }[]).map((d) => d.caminho);
    if (caminhos.length) await adm().storage.from("mensagens-anexos").remove(caminhos);
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("a rede cai no envio: erro visível, a prévia fica; de novo, conclui uma vez", async ({ browser }) => {
    const p = await entrar(browser, inq.email, senha);
    await abrirComPdf(p);
    await p.route(ROTA, (r) => (r.request().method() === "POST" ? r.abort("internetdisconnected") : r.continue()));
    await p.getByTestId("anexo-enviar").click();
    await expect(p.getByTestId("anexo-erro")).toHaveText("Não foi possível enviar o anexo agora. Tente de novo.", { timeout: 20_000 });
    await expect(p.getByTestId("anexo-previa")).toBeVisible();
    await expect(p.getByTestId("anexo-enviar")).toHaveText("Enviar anexo");
    expect(await anexos()).toBe(0);

    await p.unroute(ROTA);
    await p.getByTestId("anexo-enviar").click();
    await expect(p.getByTestId("anexo-previa")).toHaveCount(0, { timeout: 30_000 });
    await expect(p.getByTestId("anexo-erro")).toHaveCount(0);
    await expect.poll(anexos, { timeout: 20_000 }).toBe(1);
    await expect(p.getByTestId("anexo-pdf")).toHaveCount(1);
    await p.context().close();
  });

  test("o servidor recusa no meio (500): a mensagem dele aparece; de novo, conclui sem duplicar", async ({ browser }) => {
    const p = await entrar(browser, inq.email, senha);
    const antes = await anexos();
    await abrirComPdf(p);
    let falhas = 0;
    await p.route(ROTA, async (r) => {
      if (r.request().method() !== "POST" || falhas > 0) return r.continue();
      falhas++;
      await r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Não foi possível salvar o anexo agora." }) });
    });
    await p.getByTestId("anexo-enviar").click();
    await expect(p.getByTestId("anexo-erro")).toHaveText("Não foi possível salvar o anexo agora.", { timeout: 20_000 });
    await expect(p.getByTestId("anexo-previa")).toBeVisible();
    expect(await anexos()).toBe(antes);

    await p.getByTestId("anexo-enviar").click();
    await expect(p.getByTestId("anexo-previa")).toHaveCount(0, { timeout: 30_000 });
    await expect.poll(anexos, { timeout: 20_000 }).toBe(antes + 1);
    await p.reload({ waitUntil: "networkidle" });
    await p.getByRole("button", { name: new RegExp(`Studio da falha ${sufixo}`) }).first().click();
    await expect(p.getByTestId("anexo-pdf")).toHaveCount(antes + 1);
    await p.context().close();
  });
});
