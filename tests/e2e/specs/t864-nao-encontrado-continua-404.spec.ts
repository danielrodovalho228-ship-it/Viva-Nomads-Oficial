import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T864 — O "NÃO ENCONTRADO" E O "AINDA NÃO É PARCEIRO" CONTINUAM DE PÉ (Pista C, 01/11; merges #1868 e #1870, "Erros,
  achados nº 14 e 15"). Os dois merges passaram a mostrar "Não conseguimos abrir esta tela" (painel-erro) quando o
  BANCO falha — antes a falha virava "contrato não encontrado" (404) ou "você ainda não é parceiro". A falha do banco
  é do servidor e tem teste de unidade em cada merge. Aqui, o lado que a troca poderia quebrar, sem falha nenhuma:
   1) #1868: a estadia de um contrato que NÃO EXISTE (uuid novo) segue 404, sem a tela de erro;
   2) #1868: a estadia de um contrato que existe mas é de OUTRAS pessoas segue 404 para quem não é parte, sem a tela
      de erro (o contrato é um qualquer do laboratório; a spec só lê);
   3) #1870: quem ainda não é parceiro, em /dashboard/parceiro, vê o formulário "Quero ser parceiro"
      (seja-parceiro-form), sem a tela de erro.
  Conta do laboratório, criada e apagada aqui. A 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t864.${sufixo}@lab.vivanomads.test`, nome: "Nico Naoparte", role: "tenant" as const };
const ids: { morador?: string } = {};

test.describe("T864 — 404 e 'ainda não é parceiro' continuam de pé (#1868, #1870)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador]);
  });

  test("1 e 2. estadia de contrato inexistente ou de outras pessoas: 404, sem a tela de erro", async ({ browser }) => {
    const page = await entrar(browser, morador.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });

    const r1 = await page.goto(`/dashboard/estadia/${randomUUID()}`, { waitUntil: "domcontentloaded" });
    expect(r1?.status(), "contrato que não existe").toBe(404);
    await expect(page.getByTestId("painel-erro")).toHaveCount(0);

    // A conta nova não é dona de imóvel nenhum: basta o contrato não ter ela como morador.
    const { data, error } = await adm().from("contratos").select("id, tenant_id").limit(20);
    expect(error).toBeNull();
    const alheio = (data ?? []).find((c) => c.tenant_id !== ids.morador);
    test.skip(!alheio, "nenhum contrato no laboratório para o caso 'de outras pessoas'");
    const r2 = await page.goto(`/dashboard/estadia/${alheio!.id}`, { waitUntil: "domcontentloaded" });
    expect(r2?.status(), "contrato de outras pessoas").toBe(404);
    await expect(page.getByTestId("painel-erro")).toHaveCount(0);
    await page.context().close();
  });

  test("3. quem ainda não é parceiro vê o formulário 'Quero ser parceiro', sem a tela de erro", async ({ browser }) => {
    const page = await entrar(browser, morador.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    const r = await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(400);
    await expect(page.getByTestId("seja-parceiro-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("painel-erro")).toHaveCount(0);
    await expect(page.getByTestId("parceiro-aprovado")).toHaveCount(0);
    await page.context().close();
  });
});
