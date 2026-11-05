import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { AVISO_OFENSA } from "../../../src/lib/messages/ofensas";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1172 — E480 (#2677, 05/11): o xingamento comum DIRIGIDO ("seu idiota") passa pelo aviso e pela moderação. A mensagem do
 * reteste, "isso é um lixo, seu idiota", passava íntegra (a lista do E445 só tinha os graves). A lista v2 pega os comuns só
 * na forma dirigida (seu/sua X, você é um/uma X, vc é X); o adjetivo solto segue livre. O E480 entrou só com teste de
 * unidade; aqui é a conversa de verdade, 390 e 1280:
 *   1. "isso é um lixo, seu idiota <ref>" → o aviso de ofensa (aviso-ofensa, com o texto AVISO_OFENSA) aparece e NADA é gravado;
 *   2. "Revisar a mensagem" fecha o aviso sem gravar;
 *   3. "isso é um lixo <ref>" (sem ser dirigido) vai direto: gravado, sem aviso;
 *   4. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1172.${sufixo}@lab.vivanomads.test`, nome: "Paulo Respeito", role: "owner" as const };
const morador = { email: `inq.t1172.${sufixo}@lab.vivanomads.test`, nome: "Rita Respeito", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string } = {};
const gravadas = async (texto: string) => ((await adm().from("messages").select("id").eq("property_id", ids.imovel!).eq("body", texto)).data ?? []).length;

test.describe("T1172 — E480: xingamento dirigido passa pelo aviso; o adjetivo solto segue livre", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do respeito ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.morador, ids.imovel, true);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.morador, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`"seu idiota" avisa e não grava; "isso é um lixo" vai direto (${w})`, async ({ browser }) => {
      const dirigido = `isso é um lixo, seu idiota ${w}-${sufixo}`;
      const solto = `isso é um lixo ${w}-${sufixo}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), morador.email, senha);
        await p.goto(`/dashboard/mensagens?conversa=${conversationId(ids.dono!, ids.morador!, ids.imovel!)}`, { waitUntil: "domcontentloaded" });
        const campo = p.getByTestId("mensagem-campo");
        await expect(campo).toBeVisible({ timeout: 30_000 });

        await campo.fill(dirigido);
        await p.getByRole("button", { name: "Enviar" }).click();
        const aviso = p.getByTestId("aviso-ofensa");
        await expect(aviso).toBeVisible({ timeout: 15_000 });
        await expect(aviso).toContainText(AVISO_OFENSA);
        await p.waitForTimeout(1_500);
        expect(await gravadas(dirigido), "o dirigido não é gravado sem o 'Enviar mesmo assim'").toBe(0);
        await aviso.getByRole("button", { name: "Revisar a mensagem" }).click();
        await expect(aviso).toHaveCount(0);
        expect(await gravadas(dirigido)).toBe(0);

        await campo.fill(solto);
        await p.getByRole("button", { name: "Enviar" }).click();
        await expect.poll(() => gravadas(solto), { timeout: 20_000, message: "o adjetivo solto vai direto" }).toBe(1);
        await expect(p.getByTestId("aviso-ofensa")).toHaveCount(0);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
