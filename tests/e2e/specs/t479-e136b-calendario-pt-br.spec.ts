import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T479 — E136 NÃO FECHOU (QA do Muse, 25/10): no computador, o pop-up do seletor de datas de "Disponível a partir de" e
  "Disponível até" (Passo 9) saía no idioma do NAVEGADOR: "November 2026", "S M T W T F S", "Sunday, November 1, 2026",
  "Clear", "Today". O calendário agora é o do site e sempre em pt-BR: mês, dias da semana, rótulo de cada dia para o
  leitor de tela, "Limpar" e "Hoje". Vale onde o mesmo campo aparece: pedido de moradia e filtro de datas da busca.
  O navegador do teste fica em inglês (en-US) de propósito.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t479.${sufixo}@lab.vivanomads.test`, nome: "Clara Calendário", role: "owner" as const };
const ids: Record<string, string> = {};
const MESES = /^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de \d{4}$/;
const INGLES = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Clear|Today)\b/;

/** Abre o calendário do campo e confere tudo em pt-BR. Devolve o pop-up. */
async function conferePopup(p: Page, campo: string): Promise<Locator> {
  await p.getByTestId(`${campo}-calendario`).click();
  const pop = p.getByTestId(`${campo}-calendario-popup`);
  await expect(pop).toBeVisible();
  await expect(pop).toHaveAttribute("aria-label", /^Calendário/);
  await expect(pop.getByTestId(`${campo}-calendario-popup-titulo`)).toHaveText(MESES);
  await expect(pop.getByTestId(`${campo}-calendario-popup-dia-semana`)).toHaveText(["D", "S", "T", "Q", "Q", "S", "S"]);
  await expect(pop.getByTestId(`${campo}-calendario-popup-limpar`)).toHaveText("Limpar");
  await expect(pop.getByTestId(`${campo}-calendario-popup-hoje`)).toHaveText("Hoje");
  await expect(pop.getByRole("button", { name: "Mês anterior" })).toBeVisible();
  await expect(pop.getByRole("button", { name: "Próximo mês" })).toBeVisible();
  // Rótulo de cada dia para o leitor de tela: "domingo, 1 de novembro de 2026".
  const rotulo = await pop.locator("[data-dia]").first().getAttribute("aria-label");
  expect(rotulo).toMatch(/^(domingo|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado), 1 de [a-zç]+ de \d{4}$/);
  // Nada em inglês: nem o texto, nem os rótulos de acessibilidade.
  expect(await pop.innerText()).not.toMatch(INGLES);
  const rotulos = await pop.locator("[aria-label]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")).join(" | "));
  expect(rotulos).not.toMatch(INGLES);
  return pop;
}

test.describe("T479 — E136: o calendário das datas é do site e sempre em pt-BR", () => {
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ locale: "en-US", viewport: { width: 1280, height: 900 } });

  test("Passo 9: 'Disponível a partir de' e 'Disponível até' — mês, dias, rótulos, Limpar e Hoje em pt-BR", async ({ browser }) => {
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    try {
      const ctx = await browser.newContext({ locale: "en-US", viewport: { width: 1280, height: 900 } });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t479 ${sufixo}`, {});
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=disponibilidade`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "disponibilidade", 30_000);

      // "Disponível a partir de": próximo mês, dia 10.
      let pop = await conferePopup(p, "disponivel-de");
      await p.screenshot({ path: `${SAIDA}/t479-passo9-de-1280.png` });
      await pop.getByRole("button", { name: "Próximo mês" }).click();
      const titulo = (await pop.getByTestId("disponivel-de-calendario-popup-titulo").innerText()).toLowerCase();
      await pop.locator("[data-dia$='-10']").click();
      await expect(pop).toHaveCount(0);
      const valorDe = await p.getByTestId("disponivel-de").inputValue();
      expect(valorDe).toMatch(/^10\/\d{2}\/\d{4}$/);
      expect(titulo).toMatch(MESES);

      // "Disponível até": abre no mês certo, os dias antes do início ficam bloqueados; Escape fecha; Limpar esvazia.
      pop = await conferePopup(p, "disponivel-ate");
      // Abre no mês do início; os dias antes dele ficam bloqueados.
      expect((await pop.getByTestId("disponivel-ate-calendario-popup-titulo").innerText()).toLowerCase()).toBe(titulo);
      await expect(pop.locator("[data-dia$='-09']")).toBeDisabled();
      await p.screenshot({ path: `${SAIDA}/t479-passo9-ate-1280.png` });
      await p.keyboard.press("Escape");
      await expect(pop).toHaveCount(0);
      await expect(p.getByTestId("disponivel-ate-calendario")).toBeFocused();
      pop = await conferePopup(p, "disponivel-ate");
      await pop.locator("[data-dia$='-28']").click();
      await expect(p.getByTestId("disponivel-ate")).toHaveValue(/^28\/\d{2}\/\d{4}$/);
      pop = await conferePopup(p, "disponivel-ate");
      await pop.getByTestId("disponivel-ate-calendario-popup-limpar").click();
      await expect(p.getByTestId("disponivel-ate")).toHaveValue("");

      // "Hoje" no início: hoje em dd/mm/aaaa. Clique fora fecha.
      pop = await conferePopup(p, "disponivel-de");
      await pop.getByTestId("disponivel-de-calendario-popup-hoje").click();
      await expect(p.getByTestId("disponivel-de")).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
      await conferePopup(p, "disponivel-de");
      await p.getByTestId("passo-titulo").click();
      await expect(p.getByTestId("disponivel-de-calendario-popup")).toHaveCount(0);
      await ctx.close();
    } finally {
      await apagarContas([ids.dono]);
    }
  });

  test("pedido de moradia: o mesmo calendário em pt-BR", async ({ page }) => {
    await page.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
    const pop = await conferePopup(page, "pedido-data");
    await page.screenshot({ path: `${SAIDA}/t479-pedido-1280.png` });
    await pop.getByRole("button", { name: "Próximo mês" }).click();
    await pop.locator("[data-dia$='-15']").click();
    await expect(page.getByTestId("pedido-data")).toHaveValue(/^15\/\d{2}\/\d{4}$/);
  });

  test("filtro de datas da busca: o mesmo calendário em pt-BR", async ({ page }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(async () => {
      await page.getByTestId("pilula-datas").click({ timeout: 5_000 });
      await expect(page.getByTestId("painel-pilula-datas")).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    const pop = await conferePopup(page, "pilula-datas-entrada");
    await page.screenshot({ path: `${SAIDA}/t479-busca-1280.png` });
    await pop.getByRole("button", { name: "Próximo mês" }).click();
    await pop.locator("[data-dia$='-05']").click();
    await expect(page.getByTestId("pilula-datas-entrada")).toHaveValue(/^05\/\d{2}\/\d{4}$/);
  });
});
