import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T84 — chips da caixa de Mensagens (Clareza UX6-b, ordem f1b437bb; Prompt 32): Todas / Como proprietário /
 * Como morador / Parceiros / Falar com a Viva (ids: todas, proprietario, inquilino, parceiros, suporte). O dono vê a
 * conversa em "Como proprietário"; o morador, em "Como morador"; nenhum dos dois tem conversa em "Parceiros" nem em
 * "Falar com a Viva".
 * E168 (QA ao vivo do Muse, 25/10): a 1280 px (lista e conversa lado a lado), o painel da conversa acompanha o
 * filtro — filtro sem conversa = painel vazio, nunca a conversa de outro filtro.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.flt.${sufixo}@lab.vivanomads.test`, nome: "Dora Donafiltro", role: "owner" as const };
const inq = { email: `inq.flt.${sufixo}@lab.vivanomads.test`, nome: "Iara Inquilinafiltro", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};

test.describe("T84 — filtros da caixa de Mensagens", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio dos filtros ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.inq, ids.imovel);
    await gravarMensagem(ids.inq, ids.dono, ids.imovel, "Oi! Posso visitar o studio?", conversationId(ids.inq, ids.dono, ids.imovel));
  });

  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  async function contagem(pagina: import("@playwright/test").Page, id: string) {
    const chip = pagina.getByTestId(`mensagens-filtro-${id}`);
    await expect(chip).toBeVisible();
    return chip;
  }

  test("o dono acha a conversa em 'Como proprietário' e não em 'Como inquilino'", async ({ browser }) => {
    test.setTimeout(90_000);
    const pagina = await entrar(browser, dono.email, senha);
    await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await contagem(pagina, "todas");
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(1);

    await (await contagem(pagina, "proprietario")).click();
    await expect(pagina.getByTestId("mensagens-filtro-proprietario")).toHaveAttribute("aria-pressed", "true");
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(1);

    await (await contagem(pagina, "inquilino")).click();
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(0);
    await expect(pagina.getByTestId("mensagens-filtro-vazio")).toBeVisible();

    await (await contagem(pagina, "suporte")).click();
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(0);

    await (await contagem(pagina, "parceiros")).click();
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(0);

    await (await contagem(pagina, "todas")).click();
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(1);
    await pagina.context().close();
  });

  test("o inquilino acha a conversa em 'Como inquilino' e não em 'Como proprietário'", async ({ browser }) => {
    test.setTimeout(90_000);
    const pagina = await entrar(browser, inq.email, senha);
    await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await (await contagem(pagina, "inquilino")).click();
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(1);
    await (await contagem(pagina, "proprietario")).click();
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(0);
    await (await contagem(pagina, "suporte")).click();
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(0);
    await pagina.context().close();
  });

  test("E168 — a 1280 px, o painel da conversa acompanha o filtro (filtro vazio = painel vazio)", async ({ browser }) => {
    test.setTimeout(90_000);
    const pagina = await entrar(browser, dono.email, senha);
    await pagina.setViewportSize({ width: 1280, height: 900 });
    await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await expect(pagina.getByTestId("conversa-nome"), "a conversa aberta em Todas").toBeVisible({ timeout: 30_000 });
    await pagina.getByTestId("mensagens-filtro-inquilino").click();
    await expect(pagina.getByTestId("mensagens-conversa")).toHaveCount(0);
    await expect(pagina.getByTestId("conversa-nome"), "nenhuma conversa de outro filtro no painel").toHaveCount(0);
    await expect(pagina.getByTestId("mensagem-campo")).toHaveCount(0);
    await expect(pagina.getByTestId("mensagens-detalhe-vazio")).toBeVisible();
    await expect(pagina.getByTestId("mensagens-detalhe-vazio")).toContainText("Não há conversa neste filtro.");
    await pagina.screenshot({ path: "tests/laboratorio/saida/t84-e168-filtro-vazio-1280.png" });
    await pagina.getByTestId("mensagens-filtro-proprietario").click();
    await expect(pagina.getByTestId("mensagens-detalhe-vazio")).toHaveCount(0);
    await expect(pagina.getByTestId("conversa-nome")).toBeVisible();
    await pagina.context().close();
  });
});
