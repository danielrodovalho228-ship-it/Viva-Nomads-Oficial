import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T541 — E168 (#1383), guarda permanente da Pista C: a t84 abre a caixa e troca o filtro. Aqui a conversa é ABERTA
  pelo clique (como a pessoa faz) e só depois o filtro "Como morador" (que zera a lista do dono) é escolhido:
   - o painel da conversa esvazia (sem o nome, sem o campo de resposta, com o aviso de filtro vazio);
   - voltar a "Como proprietário" traz a conversa de volta.
  A 1024 (o primeiro tamanho com lista e conversa lado a lado) e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t541.${sufixo}@lab.vivanomads.test`, nome: "Dalva Caixa", role: "owner" as const };
const inq = { email: `inq.t541.${sufixo}@lab.vivanomads.test`, nome: "Ivo Conversa", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T541 — E168: o painel da conversa acompanha o filtro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da caixa t541 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.inq, ids.imovel);
    await gravarMensagem(ids.inq, ids.dono, ids.imovel, "Oi! O studio ainda está disponível?", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [1024, 1280] as const) {
    test(`a ${w} px: conversa aberta pelo clique some do painel no filtro vazio`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
      const conversa = page.getByTestId("mensagens-conversa");
      await expect(conversa).toHaveCount(1, { timeout: 30_000 });
      await conversa.first().click();
      await expect(page.getByTestId("conversa-nome")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("mensagem-campo")).toBeVisible();

      await page.getByTestId("mensagens-filtro-inquilino").click();
      await expect(page.getByTestId("mensagens-filtro-inquilino")).toHaveAttribute("aria-pressed", "true");
      await expect(conversa).toHaveCount(0);
      await expect(page.getByTestId("conversa-nome"), "a conversa de outro filtro ficou no painel").toHaveCount(0);
      await expect(page.getByTestId("mensagem-campo")).toHaveCount(0);
      await expect(page.getByTestId("mensagens-detalhe-vazio")).toBeVisible();
      await page.screenshot({ path: `tests/laboratorio/saida/t541-filtro-vazio-${w}.png` });

      await page.getByTestId("mensagens-filtro-proprietario").click();
      await expect(conversa).toHaveCount(1);
      await conversa.first().click();
      await expect(page.getByTestId("conversa-nome")).toBeVisible({ timeout: 20_000 });
      await page.context().close();
    });
  }
});
