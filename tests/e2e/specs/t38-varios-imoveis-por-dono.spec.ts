import { test, expect } from "@playwright/test";
import { LIMITE_ANUNCIOS } from "../../../src/config/planos";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  contarAtivos,
  criarConta,
  criarImovelPronto,
  definirPlano,
  entrar,
  novaSenha,
  novoSufixo,
  publicarPeloEditor,
  statusDoImovel,
} from "../fixtures/laboratorio";

/**
 * T38 — VÁRIOS IMÓVEIS POR DONO (laboratório). Conta NOVA de proprietário (CPF,
 * 4 imóveis prontos: 8 fotos geradas aqui, descrição, Caução, documento aprovado).
 *  1. Plano Gratuito (limite 1): o 1º imóvel publica; o 2º mostra "Vaga no seu
 *     plano" e o botão Publicar fica travado; um editor aberto ANTES (tela velha)
 *     também é barrado pelo servidor, com a mensagem do plano.
 *  2. Caminho para assinar: Assinatura mostra Essencial (5) e Profissional (20)
 *     com o botão de assinar; assinar o Essencial cria o pedido de cobrança.
 *  3. Plano Essencial valendo (o que o webhook do pagamento faria): o 2º, 3º e
 *     4º imóveis publicam pelo editor — 4 ativos.
 * Falha conhecida (marcada, não escondida): a tela Assinatura mostra "Gratuito"
 * como plano atual para quem já assina (achado para o Otávio).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.varios.${sufixo}@lab.vivanomads.test`, nome: "Vera Varios Imoveis", role: "owner" as const };
const ids: { dono?: string; imoveis: string[] } = { imoveis: [] };

test.describe("T38 — Vários imóveis por dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (let i = 1; i <= 4; i++) ids.imoveis.push(await criarImovelPronto(ids.dono, `Studio ${i} do teste de vários imóveis ${sufixo}`));
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("a tabela de planos do código é 1 / 5 / 20 anúncios", () => {
    expect(LIMITE_ANUNCIOS.free).toBe(1);
    expect(LIMITE_ANUNCIOS.essential).toBe(5);
    expect(LIMITE_ANUNCIOS.pro).toBe(20);
  });

  test("Gratuito: o 1º publica; o 2º fica sem vaga, com a mensagem do plano", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);

    // O 1º publica pelo editor (vaga do plano Gratuito).
    await publicarPeloEditor(page, ids.imoveis[0]);
    await expect(page.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 20_000 });
    expect(await statusDoImovel(ids.imoveis[0])).toBe("active");

    // Editor do 2º: a prontidão já sabe que não há vaga e trava o botão.
    await page.goto(`/dashboard/imoveis/${ids.imoveis[1]}/editar`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("prontidao")).toContainText("Anúncio", { timeout: 15_000 });
    await expect(page.getByText(/Vaga no seu plano/).first()).toBeVisible();
    await expect(page.getByText(/o plano já tem o máximo de anúncios publicados — pause um ou faça upgrade/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Publicar", exact: true })).toBeDisabled();
    await page.screenshot({ path: "tests/laboratorio/saida/t38-1-gratuito-sem-vaga.png", fullPage: true });
    expect(await statusDoImovel(ids.imoveis[1])).toBe("draft");
    expect(await contarAtivos(ids.dono!)).toBe(1);
    await page.context().close();
  });

  test("o servidor recusa o 2º publicado mesmo com a tela desatualizada (mensagem do plano)", async ({ browser }) => {
    test.setTimeout(120_000);
    // Põe o 1º de volta em rascunho para abrir o editor do 2º "com vaga"; depois
    // publica o 1º por baixo dos panos (como outra aba faria) e tenta publicar o 2º.
    await adm().from("properties").update({ status: "draft" }).eq("id", ids.imoveis[0]);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/${ids.imoveis[1]}/editar`, { waitUntil: "networkidle" });
    const publicar = page.getByRole("button", { name: "Publicar", exact: true });
    await expect(publicar).toBeEnabled();

    await adm().from("properties").update({ status: "active" }).eq("id", ids.imoveis[0]);
    await publicar.click();
    await expect(page.getByText(/Seu plano \(Gratuito\) permite até 1 anúncio\(s\) publicado\(s\)\. Pause um anúncio ou faça upgrade para publicar mais\./)).toBeVisible({ timeout: 15_000 });
    expect(await statusDoImovel(ids.imoveis[1])).toBe("draft");
    expect(await contarAtivos(ids.dono!)).toBe(1);
    await page.screenshot({ path: "tests/laboratorio/saida/t38-2-servidor-barra-segundo.png", fullPage: true });
    await page.context().close();
  });

  test("caminho para assinar: Essencial (5) e Profissional (20) com o botão de assinar", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/assinatura", { waitUntil: "networkidle" });

    const essencial = page.locator("div").filter({ has: page.getByRole("heading", { name: /^Essencial$/ }) }).last();
    const profissional = page.locator("div").filter({ has: page.getByRole("heading", { name: /^Profissional$/ }) }).last();
    await expect(essencial).toContainText("Até 5 anúncios ativos");
    await expect(profissional).toContainText("Até 20 anúncios ativos");
    await expect(essencial.getByRole("button", { name: "Assinar Essencial" })).toBeEnabled();
    await expect(profissional.getByRole("button", { name: "Assinar Profissional" })).toBeEnabled();

    // Profissional: abre a forma de pagamento (o pedido de cobrança sai uma vez por dia por conta).
    await profissional.getByRole("button", { name: "Assinar Profissional" }).click();
    await expect(page.getByRole("button", { name: /Assinar Profissional via pix/i })).toBeVisible();

    // Essencial: confirma o pedido (Asaas simulado).
    await essencial.getByRole("button", { name: "Assinar Essencial" }).click();
    await page.getByRole("button", { name: /Assinar Essencial via pix/i }).click();
    await expect(page.getByText(/Assinatura criada/)).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "tests/laboratorio/saida/t38-3-assinar-essencial.png", fullPage: true });
    await page.context().close();
  });

  test("Essencial valendo: o 2º, 3º e 4º imóveis publicam (4 ativos, dentro do limite de 5)", async ({ browser }) => {
    test.setTimeout(180_000);
    // O pagamento confirmado (webhook) ativa o plano; aqui o laboratório faz o mesmo.
    await definirPlano(ids.dono!, "essential");
    const page = await entrar(browser, dono.email, senha);
    for (const id of ids.imoveis.slice(1)) {
      await publicarPeloEditor(page, id);
      await expect(page.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 20_000 });
      expect(await statusDoImovel(id)).toBe("active");
    }
    expect(await contarAtivos(ids.dono!)).toBe(4);

    await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    for (let i = 1; i <= 4; i++) await expect(page.getByText(`Studio ${i} do teste de vários imóveis ${sufixo}`).first()).toBeVisible();
    await page.screenshot({ path: "tests/laboratorio/saida/t38-4-quatro-ativos.png", fullPage: true });
    await page.context().close();
  });

  test("a tela Assinatura mostra o plano Essencial como atual (corrigido no PR #321)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/assinatura", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Plano atual" })).toHaveCount(1);
    await expect(page.getByTestId("plano-atual")).toContainText("Essencial");
    await page.context().close();
  });
});
