// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T451 — Cadastro 01-b (E87) + E102-A. Só no laboratório.
   1. Passo 1, a 390 e 1280 px (E607): grade como no mockup — Casa, Apartamento e Quarto à vista e "Ver mais tipos" abre os
      9 (3 por linha no computador, lista no celular), todos com foto, nada cortado; nenhum chip nem "Outros tipos". O cartão
      marcado leva o selo verde.
   2. E102-A: na Revisão, o bloco "Dados da chácara/sítio" mostra os valores preenchidos; o subtítulo do Passo 9 sem
      "aluguel".
  Reteste do L-101 (Pista C, 05/11): rolagem lateral do assistente a 390 px corrigida no #2763; roda no portão do #2747.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.tipos.${sufixo}@lab.vivanomads.test`, nome: "Tina Tipos", role: "owner" as const };
const ids: { dono?: string; chacara?: string } = {};
const SAIDA = "tests/laboratorio/saida";
const ROTULOS = ["Casa", "Apartamento", "Quarto", "Studio", "Loft", "Cobertura", "Casa de condomínio", "Flat/apart-hotel", "Chácara/Sítio"];

test.describe("T451 — Cadastro 01-b: 9 tipos em cartões-foto; E102-A", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.chacara = await criarImovelPronto(ids.dono, `Chácara Revisão ${sufixo}`);
    const { error } = await adm()
      .from("properties")
      // O rascunho retomado (?draft=) lê o que a tela gravou em draft_data: tipo e os dados da chácara com o ponto.
      .update({
        property_type: "chacara",
        draft_data: { propertyType: "chacara", chacara: { acesso: "asfalto", internet: "fibra", ponto: { lat: -18.95, lng: -48.4 } } },
      })
      .eq("id", ids.chacara);
    expect(error).toBeNull();
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px (E607): 3 tipos à vista em grade, 'Ver mais tipos' abre os 9 sem cortar nada; sem chips`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "domcontentloaded" });
      const grade = page.getByRole("radiogroup", { name: "Tipo do imóvel" });
      await expect(grade).toBeVisible({ timeout: 30_000 });
      const cartoes = grade.getByRole("radio");
      // Como no mockup: Casa, Apartamento e Quarto à vista; nenhuma seta nem carrossel.
      await expect(cartoes).toHaveCount(3);
      expect((await cartoes.allTextContents()).map((t) => t.trim())).toEqual(ROTULOS.slice(0, 3));
      await expect(page.getByTestId("tipos-seta-direita")).toHaveCount(0);
      const ver = page.getByTestId("tipos-ver-mais");
      await expect(ver).toHaveAttribute("aria-expanded", "false");
      await page.screenshot({ path: `${SAIDA}/t451-tipos-${w}.png` });

      await ver.click();
      await expect(ver).toHaveAttribute("aria-expanded", "true");
      await expect(cartoes).toHaveCount(9);
      expect((await cartoes.allTextContents()).map((t) => t.trim())).toEqual(ROTULOS);
      // Todos com foto (alt que descreve o tipo), sem selo por cima (E265); nenhum chip nem "Outros tipos".
      await expect(grade.locator("img")).toHaveCount(9);
      for (const alt of await grade.locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("alt") ?? ""))) expect(alt).toMatch(/^Foto de /);
      await expect(grade.getByTestId("selo-ilustrativa")).toHaveCount(0);
      await expect(page.getByText("Outros tipos")).toHaveCount(0);
      // Grade inteira: 3 por linha no computador, 1 no celular; nenhum cartão nem rótulo cortado; a página não rola de lado.
      const m = await grade.evaluate((g) => {
        const gr = g.getBoundingClientRect();
        const cs = [...g.querySelectorAll('[role="radio"]')];
        const tops = [...new Set(cs.map((c) => Math.round(c.getBoundingClientRect().top)))];
        return {
          porLinha: [...new Set(tops.map((t) => cs.filter((c) => Math.round(c.getBoundingClientRect().top) === t).length))],
          cortados: cs.filter((c) => {
            const r = c.getBoundingClientRect();
            const rot = c.querySelector("span:last-of-type") as HTMLElement | null;
            return r.right > gr.right + 1 || r.left < gr.left - 1 || (!!rot && rot.scrollWidth > rot.clientWidth + 1);
          }).length,
        };
      });
      expect(m).toEqual({ porLinha: [w === 390 ? 1 : 3], cortados: 0 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `${SAIDA}/t451-tipos-todos-${w}.png`, fullPage: true });

      // Marcar um tipo: selo verde no cartão marcado.
      await grade.getByTestId("tipo-chacara").click();
      await expect(grade.getByTestId("tipo-chacara")).toHaveAttribute("aria-checked", "true");
      await expect(grade.getByTestId("tipo-chacara").getByTestId("tipo-marcado")).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t451-tipos-chacara-${w}.png` });
      await page.context().close();
    });
  }

  test("3. Chácara/Sítio abre o bloco rural do Passo 4 (linha fixa e os 3 campos)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/novo?draft=${ids.chacara}&etapa=detalhes`, { waitUntil: "domcontentloaded" });
    const campos = page.getByTestId("campos-chacara");
    await expect(campos.getByTestId("chacara-linha-fixa")).toHaveText(
      "Anuncie só a casa para morar. Uso da terra para plantio ou criação não entra no anúncio.",
      { timeout: 30_000 },
    );
    await expect(campos.getByTestId("chacara-acesso-asfalto")).toBeChecked();
    await expect(campos.getByTestId("chacara-internet-fibra")).toBeChecked();
    await page.context().close();
  });

  test("2. E102-A: a Revisão mostra os dados da chácara/sítio preenchidos; Passo 9 sem 'aluguel'", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/novo?draft=${ids.chacara}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    const bloco = page.getByTestId("revisao-chacara");
    await expect(bloco).toBeVisible({ timeout: 30_000 });
    await expect(bloco).toContainText("Dados da chácara/sítio");
    await expect(bloco.getByTestId("revisao-chacara-acesso")).toHaveText("Acesso: Asfalto");
    await expect(bloco.getByTestId("revisao-chacara-internet")).toHaveText("Internet: Fibra");
    await expect(bloco.getByTestId("revisao-chacara-ponto")).toHaveText("Ponto marcado no mapa");
    await expect(bloco.getByTestId("revisao-chacara-ponto").getByLabel("feito")).toBeVisible();
    await bloco.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t451-revisao-chacara.png` });

    await page.goto(`/dashboard/imoveis/novo?draft=${ids.chacara}&etapa=disponibilidade`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Escolha a partir de quando o imóvel está disponível e as datas que ficam fechadas.")).toBeVisible({ timeout: 30_000 });
    expect(await page.locator("main").innerText()).not.toMatch(/alugu/i);
    await page.context().close();
  });
});
