import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1154 — E582 (#2612, 05/11): o portão do CPF fala no formulário da proposta. A t876 (Pista B) cobre o dono SEM CPF
 * (a trava ao lado do botão, a mensagem com o link e nenhuma proposta criada). Aqui o CONTROLE: com CPF, o portão não
 * pode aparecer nem barrar. 390 e 1280, dono com CPF da fixture e uma candidatura:
 *   1. o formulário abre sem a trava (proposta-trava-documento) e com "Enviar proposta" habilitado;
 *   2. ao enviar, a mensagem do CPF não aparece (proposta-erro sem "informe seu CPF" e sem o link proposta-erro-documento);
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1154.${sufixo}@lab.vivanomads.test`, nome: "Paula Com Cpf", role: "owner" as const };
const inq = { email: `inq.t1154.${sufixo}@lab.vivanomads.test`, nome: "Ari Proposta", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T1154 — E582: com CPF, o portão da proposta não aparece nem barra", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa com CPF ${sufixo}`, { ativo: true, preco: 2800 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
    const { data } = await adm().from("profiles").select("cpf").eq("id", ids.dono).single();
    expect(data?.cpf ?? null, "o dono do teste tem CPF").not.toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.dono) await adm().from("propostas").delete().eq("owner_id", ids.dono);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.inq, ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`a ${largura}px: sem trava, botão habilitado e o envio sem a mensagem do CPF`, async ({ browser }) => {
      // Cada largura parte do zero: a proposta enviada na outra não pode mudar o formulário desta.
      await adm().from("propostas").delete().eq("owner_id", ids.dono!);
      const page = await entrar(browser, dono.email, senha);
      try {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await page.goto(`/dashboard/orcamentos/nova?interessado=${ids.lead}`, { waitUntil: "domcontentloaded" });
        const enviarBtn = page.getByTestId("enviar-proposta");
        await expect(enviarBtn).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId("proposta-trava-documento")).toHaveCount(0);
        await expect(enviarBtn).toBeEnabled();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

        await enviarBtn.click();
        // O envio segue o caminho normal (criar a proposta ou acusar outro campo); a mensagem do CPF nunca aparece.
        await page.waitForTimeout(3_000);
        await expect(page.getByTestId("proposta-erro-documento")).toHaveCount(0);
        const erro = page.getByTestId("proposta-erro");
        if (await erro.count()) await expect(erro).not.toContainText("informe seu CPF");
      } finally {
        await page.context().close();
      }
    });
  }
});
