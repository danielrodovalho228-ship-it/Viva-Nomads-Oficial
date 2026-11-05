import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T876 — E582: proprietário SEM CPF monta a proposta. Antes: "Enviar proposta" girava e voltava, sem erro, sem número.
 * Agora: a trava aparece ao lado do botão com "Informar meu CPF" (Conta → Documento); o envio mostra a mesma mensagem
 * com o link, sem chamar o servidor; nenhuma proposta é criada. 390 e 1280 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t876.${sufixo}@lab.vivanomads.test`, nome: "Paulo Sem Cpf", role: "owner" as const };
const inq = { email: `inq.t876.${sufixo}@lab.vivanomads.test`, nome: "Ana Proposta", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T876 — E582: proposta sem CPF fala no formulário", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, false);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa sem CPF ${sufixo}`, { ativo: true, preco: 2800 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
    const { data } = await adm().from("profiles").select("cpf").eq("id", ids.dono).single();
    expect(data?.cpf ?? null, "o dono do teste não tem CPF").toBeNull();
  });

  test.afterAll(async () => {
    if (ids.dono) await adm().from("propostas").delete().eq("owner_id", ids.dono);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.inq, ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`a ${largura}px: trava ao lado do botão; o envio mostra a mensagem com o link; nada é criado`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/orcamentos/nova?interessado=${ids.lead}`, { waitUntil: "domcontentloaded" });
      const trava = page.getByTestId("proposta-trava-documento");
      await expect(trava).toBeVisible({ timeout: 30_000 });
      await expect(trava).toContainText("Antes de enviar a proposta, informe seu CPF");
      await expect(trava.getByRole("link", { name: "Informar meu CPF" })).toHaveAttribute("href", "/dashboard/conta/dados#documento");

      await page.getByTestId("enviar-proposta").click();
      const erro = page.getByTestId("proposta-erro");
      await expect(erro).toBeVisible();
      await expect(erro).toContainText("Antes de enviar a proposta, informe seu CPF");
      await expect(page.getByTestId("proposta-erro-documento")).toHaveAttribute("href", "/dashboard/conta/dados#documento");
      await expect(page).toHaveURL(/\/dashboard\/orcamentos\/nova/);

      const { count } = await adm().from("propostas").select("id", { count: "exact", head: true }).eq("lead_id", ids.lead!);
      expect(count ?? 0).toBe(0);
      await page.context().close();
    });
  }
});
