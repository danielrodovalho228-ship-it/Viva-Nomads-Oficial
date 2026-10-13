import { test, expect } from "@playwright/test";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  entrar,
  novaSenha,
  novoSufixo,
  tornarContratoVigente,
} from "../fixtures/laboratorio";

/**
 * T60 — F27 (ordem a8905671, item d; ajuste aacf3759 do Moacir): "ativo" no banco NÃO basta
 * para pedir manutenção. Contrato `ativo` mas ainda "Aguardando assinatura" → a tela mostra
 * o aviso (manutencao-sem-contrato), não mostra o formulário e a ação do servidor recusa.
 * Depois das duas assinaturas e do 1º aluguel confirmado (Em vigência) → o formulário aparece.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.vig.${sufixo}@lab.vivanomads.test`, nome: "Otávio Vigência", role: "owner" as const };
const inquilino = { email: `inq.vig.${sufixo}@lab.vivanomads.test`, nome: "Iara Vigência", role: "tenant" as const };
const ids: { dono?: string; inquilino?: string; imovel?: string; contrato?: string } = {};

test.describe("T60 — Manutenção só com contrato em vigência (F27)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio mobiliado vigência ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inquilino,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("1. ativo mas Aguardando assinatura: aviso na tela, sem formulário e sem ordem no banco", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/dashboard/solicitacoes", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Minhas solicitações" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("manutencao-sem-contrato")).toBeVisible();
    await expect(page.getByPlaceholder("Descreva o problema...")).toHaveCount(0);
    const { count } = await adm().from("service_orders").select("id", { count: "exact", head: true }).eq("tenant_id", ids.inquilino!);
    expect(count).toBe(0);
    await page.context().close();
  });

  test("2. Em vigência (2 assinaturas + 1º aluguel confirmado): o formulário aparece", async ({ browser }) => {
    test.setTimeout(90_000);
    await tornarContratoVigente(ids.contrato!, ids.dono!);
    const page = await entrar(browser, inquilino.email, senha);
    await page.goto("/dashboard/solicitacoes", { waitUntil: "networkidle" });
    await expect(page.getByTestId("manutencao-sem-contrato")).toHaveCount(0);
    await page.getByRole("button", { name: /Abrir solicitação/ }).click();
    await expect(page.getByPlaceholder("Descreva o problema...")).toBeVisible();
    await page.context().close();
  });
});
