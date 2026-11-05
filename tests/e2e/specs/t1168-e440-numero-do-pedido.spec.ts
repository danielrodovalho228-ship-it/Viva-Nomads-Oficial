import { test, expect } from "@playwright/test";
import { numeroPublicoPedido } from "../../../src/lib/pedido-ref";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1168 — E440 (#2663, 05/11): o pedido é numerado desde o envio. Antes "Pedido nº VN-PD-…" só aparecia no cartão de
 * Minhas candidaturas com a candidatura aceita; agora aparece em TODO cartão (o mesmo número do e-mail e do contrato). O
 * E440 entrou só com teste de unidade; aqui é a tela, 390 e 1280, com duas candidaturas da mesma moradora a anúncios
 * diferentes — uma enviada (sem resposta) e uma recusada:
 *   1. cada cartão mostra candidatura-numero-pedido-cartao com o número do SEU pedido (VN-PD-<8 primeiros do id>);
 *   2. os dois números são diferentes;
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1168.${sufixo}@lab.vivanomads.test`, nome: "Neto Numeros", role: "owner" as const };
const morador = { email: `inq.t1168.${sufixo}@lab.vivanomads.test`, nome: "Olga Pedidos", role: "tenant" as const };
const ids: { dono?: string; morador?: string; a?: string; b?: string; leadA?: string; leadB?: string } = {};

test.describe("T1168 — E440: todo cartão de Minhas candidaturas traz o número do pedido", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.a = await criarImovelPronto(ids.dono, `Studio pedido A ${sufixo}`, { ativo: true });
    ids.b = await criarImovelPronto(ids.dono, `Studio pedido B ${sufixo}`, { ativo: true });
    ids.leadA = await criarLead(ids.dono, ids.morador, ids.a);
    ids.leadB = await criarLead(ids.dono, ids.morador, ids.b);
    const { error } = await adm().from("leads").update({ status: "rejected" }).eq("id", ids.leadB);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.morador, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`enviada e recusada: cada cartão com o número do seu pedido (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), morador.email, senha);
        await p.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
        const numeros: string[] = [];
        for (const lead of [ids.leadA!, ids.leadB!]) {
          const esperado = numeroPublicoPedido(lead)!;
          const cartao = p.locator(`#candidatura-${lead}`);
          await expect(cartao, lead).toBeVisible({ timeout: 30_000 });
          await expect(cartao.getByTestId("candidatura-numero-pedido-cartao")).toHaveText(`Pedido nº ${esperado}`);
          numeros.push(esperado);
        }
        expect(numeros[0]).not.toBe(numeros[1]);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
