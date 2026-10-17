import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T175 — Mensagens com a mesma regra do cartão do candidato (prompt 6), a 390 e 1280 px.
  1. Antes do aceite o proprietário vê "Candidato(a)": sem nome, sem foto e sem contato.
  2. Depois do aceite: nome curto ("Iara S.") e a foto.
  3. O inquilino vê o nome curto do proprietário, nunca o sobrenome completo.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.msgc.${sufixo}@lab.vivanomads.test`, nome: "Dora Donamensagem Sobrenomedona", role: "owner" as const };
const inq = { email: `inq.msgc.${sufixo}@lab.vivanomads.test`, nome: "Iara Inquilinamsg Sobrenomeoculto", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};
const SAIDA = "tests/laboratorio/saida";

async function abrirConversa(page: Page) {
  await page.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(`Studio do chat ${sufixo}`) }).first().click();
}

test.describe("T175 — Mensagens: Candidato(a) antes do aceite, nome curto e foto depois", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do chat ${sufixo}`, { ativo: true });
    const caminho = `${ids.inq}/avatar.webp`;
    await adm().storage.from("avatars").upload(caminho, pngDeTeste(9, 200, 200), { contentType: "image/webp", upsert: true });
    await adm().from("profiles").update({ avatar_url: caminho }).eq("id", ids.inq);
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, false);
    await gravarMensagem(ids.inq, ids.dono, ids.imovel, "Olá! Tenho interesse no studio.", conversationId(ids.inq, ids.dono, ids.imovel));
  });

  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("proprietário: 'Candidato(a)' antes do aceite; 'Iara S.' e foto depois (390 e 1280)", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await abrirConversa(page);
      await expect(page.getByTestId("conversa-nome")).toHaveText("Candidato(a)");
      await expect(page.getByTestId("conversa-avatar").locator("img")).toHaveCount(0);
      const corpo = await page.locator("main").innerText();
      expect(corpo).not.toMatch(/Iara|Inquilinamsg|Sobrenomeoculto/);
      expect(corpo).not.toContain(inq.email);
      await page.screenshot({ path: `${SAIDA}/t175-mensagens-antes-${largura}.png`, fullPage: false });
    }

    const { error } = await adm().from("leads").update({ status: "accepted" }).eq("id", ids.lead!);
    expect(error).toBeNull();
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await abrirConversa(page);
      await expect(page.getByTestId("conversa-nome")).toHaveText("Iara S.");
      await expect(page.getByTestId("conversa-avatar").locator("img")).toBeVisible({ timeout: 15_000 });
      const corpo = await page.locator("main").innerText();
      expect(corpo).not.toMatch(/Inquilinamsg|Sobrenomeoculto/);
      expect(corpo).not.toContain(inq.email);
      await page.screenshot({ path: `${SAIDA}/t175-mensagens-depois-${largura}.png`, fullPage: false });
    }
    await page.context().close();
  });

  test("inquilina: vê o nome curto do proprietário (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, inq.email, senha);
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await abrirConversa(page);
      await expect(page.getByTestId("conversa-nome")).toHaveText("Dora S.");
      const corpo = await page.locator("main").innerText();
      expect(corpo).not.toMatch(/Donamensagem|Sobrenomedona/);
      expect(corpo).not.toContain(dono.email);
    }
    await page.context().close();
  });
});
