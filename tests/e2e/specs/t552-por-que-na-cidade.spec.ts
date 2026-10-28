import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T552 — "Por que estou na cidade" (#1405, ordem 9950ef15, item 3), guarda permanente da Pista C. O #1405 não trouxe
  spec de tela; aqui:
   1. controle: na Conta › Perfil do morador, o bloco "Perfil profissional" aparece (a tela carregou no modo morador);
   2. o cartão do período, empresa e frase (data-testid "por-que-na-cidade") aparece nessa tela, com o que está
      gravado. Foi o L-70: o #1405 montou o cartão em `PerfilProfissional` (conta-blocos.tsx), que nenhuma página
      monta desde o A1 CONTA-A (6f5b9c97); o #1413 (045843b7) montou o cartão em perfil-tela.tsx;
   3. o proprietário NÃO lê o período, a empresa nem a frase antes do aceite: candidatura nova em /dashboard/leads,
      com os campos gravados no perfil da candidata;
   4. depois do aceite (#1407), outro proprietário, com a candidatura da mesma moradora ACEITA, lê na candidatura
      "Na cidade de 01/11/2026 a 30/04/2027", "Empresa ou instituição: …" e a frase entre aspas;
   5. a moradora com imóvel anunciado e o MODO PROPRIETÁRIO salvo (como a inquilino1 de produção) também vê o cartão,
      com o que está gravado, na Perfil em modo dono. Foi o E192 (reteste ao vivo de 26/10), corrigido no #1417; a t561
      da Pista A cobre a gravação.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ana = { email: `ana.t552.${sufixo}@lab.vivanomads.test`, nome: "Ana Cidade", role: "tenant" as const };
const dono = { email: `dono.t552.${sufixo}@lab.vivanomads.test`, nome: "Davi Cidade", role: "owner" as const };
/** Moradora só do caso 5 (com imóvel e modo dono salvo): o modo dono fica na conta e não pode vazar para os casos 1–4. */
const anaDono = { email: `ana2.t552.${sufixo}@lab.vivanomads.test`, nome: "Ana Modo Dono", role: "tenant" as const };
const donoAceito = { email: `dono2.t552.${sufixo}@lab.vivanomads.test`, nome: "Dora Aceite", role: "owner" as const };
const ids: Record<string, string> = {};
const EMPRESA = `Hospital Laboratório ${sufixo}`;
const FRASE = `Residência de seis meses na cidade ${sufixo}`;

async function abrirPerfil(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  // O modo vem da tela anterior (L-10): passa pelo início do morador antes da Conta.
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toContainText("Perfil profissional", { timeout: 30_000 });
}

test.describe("T552 — Por que estou na cidade: o cartão na Conta e o sigilo antes do aceite", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.ana = await criarConta(ana, senha);
    ids.dono = await criarConta(dono, senha);
    const { error } = await adm()
      .from("profiles")
      .update({ cidade_periodo_inicio: "2026-11-01", cidade_periodo_fim: "2027-04-30", cidade_empresa: EMPRESA, cidade_frase: FRASE })
      .eq("id", ids.ana);
    if (error) throw error;
    ids.anaDono = await criarConta(anaDono, senha);
    const { error: e2 } = await adm()
      .from("profiles")
      .update({ cidade_periodo_inicio: "2026-11-01", cidade_periodo_fim: "2027-04-30", cidade_empresa: EMPRESA, cidade_frase: FRASE })
      .eq("id", ids.anaDono);
    if (e2) throw e2;
    // Como a inquilino1 de produção (E192): cadastro de morador, com um imóvel anunciado e o MODO PROPRIETÁRIO salvo.
    ids.imovelAnaDono = await criarImovelPronto(ids.anaDono, `Anúncio da Ana t552 ${sufixo}`, { ativo: true });
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.anaDono);
    ids.imovel = await criarImovelPronto(ids.dono, `Cidade t552 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.ana, ids.imovel);
    ids.donoAceito = await criarConta(donoAceito, senha);
    ids.imovelAceito = await criarImovelPronto(ids.donoAceito, `Aceite t552 ${sufixo}`, { ativo: true });
    await criarLead(ids.donoAceito, ids.ana, ids.imovelAceito, true);
  });
  test.afterAll(async () => {
    await adm().from("leads").delete().in("owner_id", [ids.dono, ids.donoAceito].filter(Boolean));
    await apagarContas([ids.ana, ids.anaDono, ids.dono, ids.donoAceito]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: a Perfil do morador carrega com o bloco "Perfil profissional"`, async ({ browser }) => {
      const page = await entrar(browser, ana.email, senha);
      await abrirPerfil(page, w);
      console.log(`t552 ${w}: cartões "por-que-na-cidade" na Perfil = ${await page.getByTestId("por-que-na-cidade").count()}`);
      await page.screenshot({ path: `tests/laboratorio/saida/t552-perfil-${w}.png`, fullPage: true });
      await page.context().close();
    });

    test(`2. a ${w} px: o cartão "Por que estou na cidade" aparece na Perfil com o que está gravado`, async ({ browser }) => {
      const page = await entrar(browser, ana.email, senha);
      await abrirPerfil(page, w);
      // O bloco opcional pode vir desligado: liga antes de procurar o cartão.
      const chave = page.locator('[data-testid^="bloco-"]').filter({ hasText: "Perfil profissional" }).getByRole("switch");
      if ((await chave.count()) && (await chave.first().getAttribute("aria-checked")) === "false") await chave.first().click();
      const cartao = page.getByTestId("por-que-na-cidade");
      await expect(cartao).toBeVisible({ timeout: 15_000 });
      await expect(cartao.getByTestId("cidade-empresa")).toHaveValue(EMPRESA);
      await expect(cartao.getByTestId("cidade-frase")).toHaveValue(FRASE);
      await page.context().close();
    });

    test(`3. a ${w} px: o proprietário não lê período, empresa nem frase na candidatura antes do aceite`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      // Antes do aceite a candidatura mostra "Candidato(a)", não o nome: espera pelo imóvel do interesse.
      await expect(page.locator("main")).toContainText(`interesse em Cidade t552 ${sufixo}`, { timeout: 30_000 });
      const texto = await page.locator("main").innerText();
      expect(texto, "empresa visível antes do aceite").not.toContain(EMPRESA);
      expect(texto, "frase visível antes do aceite").not.toContain(FRASE);
      expect(texto).not.toMatch(/30\/04\/2027|01\/11\/2026/);
      await page.screenshot({ path: `tests/laboratorio/saida/t552-leads-${w}.png`, fullPage: true });
      await page.context().close();
    });

    test(`4. a ${w} px: depois do aceite o proprietário lê período, empresa e frase na candidatura (#1407)`, async ({ browser }) => {
      const page = await entrar(browser, donoAceito.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      const sinais = page.getByTestId("candidato-sinais").first();
      await expect(sinais).toContainText("Na cidade de 01/11/2026 a 30/04/2027", { timeout: 30_000 });
      await expect(sinais).toContainText(`Empresa ou instituição: ${EMPRESA}`);
      await expect(sinais).toContainText(`“${FRASE}”`);
      await sinais.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t552-leads-aceito-${w}.png` });
      await page.context().close();
    });
    test(`5. a ${w} px: moradora com imóvel, em modo dono (como a inquilino1): o cartão aparece com o que está gravado`, async ({ browser }) => {
      const page = await entrar(browser, anaDono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      // Modo dono de fato: o espelho do perfil é o do dono ("…o morador te vê no seu anúncio"). Depois do #1417 o
      // painel do morador (com o cartão) aparece também nesse modo para quem tem cadastro de morador.
      await expect(page.locator("main")).toContainText("É assim que o morador te vê no seu anúncio", { timeout: 30_000 });
      const cartao = page.getByTestId("por-que-na-cidade");
      await expect(cartao).toBeVisible({ timeout: 15_000 });
      await expect(cartao.getByTestId("cidade-empresa")).toHaveValue(EMPRESA);
      await expect(cartao.getByTestId("cidade-frase")).toHaveValue(FRASE);
      await cartao.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t552-perfil-modo-dono-${w}.png` });
      await page.context().close();
    });
  }
});

