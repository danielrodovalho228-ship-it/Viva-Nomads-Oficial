import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, fotosReais, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T280 — Minimização e eliminação, fase 1 (Prompt 58). Roteiro do reteste do Muse:
 *  1. O dono exclui o rascunho: as fotos saem do bucket, cada uma vai ao livro de eliminações (só origem, caminho,
 *     tipo, motivo e data) e o hash perceptual fica (antifraude).
 *  2. Admin › Dados e retenção: o inventário, o relatório do dia e a eliminação da semana aparecem só em números;
 *     nenhum caminho de arquivo aparece na tela.
 *  3. O chat mostra o aviso fixo: documento não vai por mensagem.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.min.${sufixo}@lab.vivanomads.test`, nome: "Dina Minimizada", role: "owner" as const };
const inq = { email: `inq.min.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilinominimo", role: "tenant" as const };
const ids: { dono?: string; inq?: string; rascunho?: string; ativo?: string } = {};
const caminhos: string[] = [];

test.describe("T280 — minimização e eliminação (fase 1)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho a excluir ${sufixo}`);
    await fotosReais(ids.rascunho, ids.dono);
    for (let i = 0; i < 8; i++) caminhos.push(`${ids.dono}/${ids.rascunho}-${i}.png`);
    // O hash de cada foto, como o envio pela tela grava (sem imóvel até ligar a foto ao anúncio).
    const { error } = await adm()
      .from("fotos_anuncio_hash")
      .insert(caminhos.map((c, i) => ({ property_id: ids.rascunho, owner_id: ids.dono, caminho: c, hash: `00000000000000${i.toString(16).padStart(2, "0")}` })));
    if (error) throw error;
    ids.ativo = await criarImovelPronto(ids.dono, `Studio do aviso ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.inq, ids.ativo);
    await gravarMensagem(ids.inq, ids.dono, ids.ativo, "Oi! Posso visitar?", conversationId(ids.inq, ids.dono, ids.ativo));
  });

  test.afterAll(async () => {
    await adm().from("fotos_anuncio_hash").delete().in("caminho", caminhos);
    await adm().from("eliminacoes_registro").delete().in("ref_id", caminhos);
    await adm().from("messages").delete().eq("property_id", ids.ativo ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. excluir o rascunho apaga as fotos, registra no livro e o hash fica", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Excluir rascunho" }).first().click();
    await page.getByTestId("excluir-rascunho-confirmar").first().click();
    await expect(page.getByText(`Rascunho a excluir ${sufixo}`)).toHaveCount(0, { timeout: 15_000 });

    const { data: restantes } = await adm().storage.from("property-photos").list(ids.dono!, { limit: 100, search: ids.rascunho! });
    expect(restantes ?? [], "nenhuma foto do rascunho fica no bucket").toHaveLength(0);
    const { data: livro } = await adm().from("eliminacoes_registro").select("*").in("ref_id", caminhos);
    expect(livro ?? []).toHaveLength(8);
    for (const l of livro ?? []) {
      expect(l).toMatchObject({ origem: "bucket:property-photos", tipo: "property-photos", motivo: "decisao", modo: "apagado" });
      expect(Object.keys(l).sort(), "o livro não guarda conteúdo").toEqual(["eliminado_em", "id", "modo", "motivo", "origem", "ref_id", "teste", "tipo"]);
    }
    const { count } = await adm().from("fotos_anuncio_hash").select("*", { count: "exact", head: true }).in("caminho", caminhos);
    expect(count, "o hash sobrevive à remoção do anúncio").toBe(8);
  });

  test.describe("admin", () => {
    test.use({ storageState: authFile("admin") });
    test("2. Dados e retenção mostra inventário, relatório e a eliminação da semana, sem caminho de arquivo", async ({ page }) => {
      await page.goto("/admin/retencao", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Dados e retenção" })).toBeVisible();
      await expect(page.getByTestId("retencao-inventario")).toContainText("inquilino-docs/recusado");
      await expect(page.getByTestId("retencao-inventario")).toContainText("30 dias depois da recusa da candidatura †");
      await expect(page.getByTestId("retencao-semana")).toContainText("property-photos · decisão");
      expect(await page.content(), "nenhum caminho de arquivo na tela").not.toContain(ids.rascunho!);
    });
  });

  test("3. o chat mostra o aviso fixo de documentos", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: new RegExp(`Studio do aviso ${sufixo}`) }).first().click();
    await expect(page.getByTestId("mensagens-aviso-documentos")).toHaveText("Não envie documentos por aqui. Para dados de ocupantes, use a página da estadia.");
  });
});
