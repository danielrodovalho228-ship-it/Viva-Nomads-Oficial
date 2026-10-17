import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T84 — chips da caixa de Mensagens (Clareza UX6-b, ordem f1b437bb): Todas / Como inquilino /
 * Como proprietário / Suporte. O dono vê a conversa em "Como proprietário"; o inquilino, em
 * "Como inquilino"; nenhum dos dois tem conversa em "Suporte" (sem imóvel).
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
});
