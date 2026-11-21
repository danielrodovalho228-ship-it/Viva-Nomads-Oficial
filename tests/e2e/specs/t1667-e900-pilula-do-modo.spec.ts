import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1667 — E900: o painel diz em que modo a pessoa está, em todas as telas, e troca num toque.
  Antes, nada na tela identificava o modo (achado do Daniel, 13/11/2026): a troca ficava escondida no menu da Conta.
  A 1280 px a pílula mora no cabeçalho; a 390 px, numa linha logo abaixo do topo.
   • quem tem um papel só (morador) vê o selo do modo: ícone + "Morador", sem interruptor;
   • quem tem os dois vê a pílula com um segmento por papel; o modo em uso tem palavra, ícone e cor própria;
   • um toque troca o modo: as abas e o Início trocam juntos, e a escolha fica gravada (vale depois de recarregar);
   • a pílula está em todas as telas do painel e nasce junto com o cabeçalho (nunca o cabeçalho sem ela).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t1667.${sufixo}@lab.vivanomads.test`, nome: "Moema Modo", role: "tenant" as const };
const dono = { email: `dono.t1667.${sufixo}@lab.vivanomads.test`, nome: "Dário Modo", role: "owner" as const };
const ids: { morador?: string; dono?: string } = {};

declare global {
  interface Window {
    __amostrasDoModo?: { topo: boolean; pilula: boolean; selo: boolean }[];
  }
}

const TELAS = [
  { largura: 1280, altura: 900, variante: "topo" },
  { largura: 390, altura: 844, variante: "linha" },
] as const;
type Tela = (typeof TELAS)[number];

const COR = { morador: "rgb(28, 107, 58)", proprietario: "rgb(122, 74, 18)" } as const;
/** Telas do painel que valem nos dois modos (a pílula tem de estar em todas). */
const TELAS_COMUNS = ["/dashboard", "/dashboard/mensagens", "/dashboard/notificacoes", "/dashboard/conta/perfil"];

/** O papel que a casca está mostrando (abas do topo no computador, barra de baixo no celular). */
async function papelDaCasca(page: Page, t: Tela): Promise<string | null> {
  const alvo = t.largura >= 1024 ? page.locator("header[data-papel]") : page.locator("nav[data-papel]:visible");
  return alvo.first().getAttribute("data-papel");
}

test.describe("T1667 — E900: a pílula do modo no cabeçalho do painel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.dono = await criarConta(dono, senha);
    await criarImovelPronto(ids.dono, `Studio modo ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador, ids.dono]);
  });

  for (const t of TELAS) {
    test(`${t.largura} px, morador sem imóvel: o selo "Morador" em todas as telas, sem interruptor`, async ({ page }) => {
      await page.setViewportSize({ width: t.largura, height: t.altura });
      await entrarNaPagina(page, morador.email, senha);
      for (const rota of TELAS_COMUNS) {
        await test.step(rota, async () => {
          await page.goto(rota, { waitUntil: "domcontentloaded" });
          const selo = page.getByTestId(`modo-selo-${t.variante}`);
          await expect(selo, "o selo do modo à vista").toBeVisible({ timeout: 20_000 });
          await expect(selo).toHaveText(/Morador/);
          await expect(selo.locator("svg"), "ícone do modo").toHaveCount(1);
          await expect(selo.locator('[data-modo="morador"]')).toHaveCSS("color", COR.morador);
          await expect(page.locator(`[data-testid^="modo-pilula-"]`), "sem interruptor para quem tem um papel só").toHaveCount(0);
          await expect(selo.getByRole("button")).toHaveCount(0);
        });
      }
    });

    test(`${t.largura} px, proprietário com imóvel: a pílula mostra o modo em uso e um toque troca (ida e volta)`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: t.largura, height: t.altura });
      await entrarNaPagina(page, dono.email, senha);
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const pilula = page.getByTestId(`modo-pilula-${t.variante}`);
      const segMorador = page.getByTestId(`modo-${t.variante}-morador`);
      const segDono = page.getByTestId(`modo-${t.variante}-proprietario`);
      await expect(pilula).toBeVisible({ timeout: 20_000 });
      await expect(pilula.getByRole("button"), "um segmento por papel da conta").toHaveCount(2);

      // O modo em uso: palavra à vista, ícone, cor própria e estado para leitor de tela.
      await expect(segDono).toHaveAttribute("aria-pressed", "true");
      await expect(segDono).toHaveText("Proprietário");
      await expect(segDono.getByText("Proprietário")).toBeVisible();
      await expect(segDono.locator("svg")).toHaveCount(1);
      await expect(segDono).toHaveCSS("color", COR.proprietario);
      await expect(segMorador).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByRole("button", { name: "Morador", exact: true }).and(segMorador), "o outro modo tem nome acessível").toHaveCount(1);
      expect(await papelDaCasca(page, t)).toBe("proprietario");
      if (t.largura < 1024) {
        const caixa = await segMorador.boundingBox();
        expect(caixa!.height, "alvo de toque de 44 px no celular").toBeGreaterThanOrEqual(44);
      }
      await expect(page.getByTestId(`modo-selo-${t.variante}`)).toHaveCount(0);

      // Um toque: vira Morador — pílula, abas e Início trocam juntos.
      await segMorador.click();
      await expect(segMorador).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
      await expect(segMorador).toHaveCSS("color", COR.morador);
      await expect(segDono).toHaveAttribute("aria-pressed", "false");
      await expect.poll(() => papelDaCasca(page, t), { timeout: 20_000 }).toBe("morador");
      await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
      await expect(page.getByRole("link", { name: "Buscar", exact: true }).first(), "as abas do morador").toBeVisible();

      // A escolha fica gravada e a pílula segue em todas as telas.
      for (const rota of TELAS_COMUNS) {
        await test.step(`morador em ${rota}`, async () => {
          await page.goto(rota, { waitUntil: "domcontentloaded" });
          await expect(segMorador).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
          await expect(pilula).toBeVisible();
        });
      }

      // E volta: um toque em Proprietário.
      await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await expect(segDono).toBeVisible({ timeout: 20_000 });
      await segDono.click();
      await expect(segDono).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
      await expect.poll(() => papelDaCasca(page, t), { timeout: 20_000 }).toBe("proprietario");
      await expect.poll(() => new URL(page.url()).pathname).toBe("/dashboard");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(segDono).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
      await expect(segDono).toHaveCSS("color", COR.proprietario);
    });
  }

  test("a pílula nasce junto com o cabeçalho: nunca o cabeçalho sem ela, nem o selo antes do interruptor", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNaPagina(page, dono.email, senha);
    // Antes de qualquer script da página: a cada mudança e a cada quadro, o que o cabeçalho mostra.
    await page.addInitScript(() => {
      const amostras: { topo: boolean; pilula: boolean; selo: boolean }[] = [];
      window.__amostrasDoModo = amostras;
      const ver = () => {
        const topo = document.querySelector("header[data-papel]");
        if (!topo) return;
        amostras.push({ topo: true, pilula: !!topo.querySelector('[data-testid="modo-pilula-topo"]'), selo: !!topo.querySelector('[data-testid="modo-selo-topo"]') });
      };
      new MutationObserver(ver).observe(document, { childList: true, subtree: true, attributes: true });
      const quadro = () => {
        ver();
        requestAnimationFrame(quadro);
      };
      quadro();
    });
    await page.goto("/dashboard", { waitUntil: "load" });
    await expect(page.getByTestId("modo-pilula-topo")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2500);
    const amostras = await page.evaluate(() => window.__amostrasDoModo ?? []);
    expect(amostras.length, "amostras com o cabeçalho na tela").toBeGreaterThan(20);
    expect(amostras.filter((a) => !a.pilula).length, "quadros com o cabeçalho e sem a pílula").toBe(0);
    expect(amostras.filter((a) => a.selo).length, "quadros com o selo no lugar do interruptor").toBe(0);
  });

  test("1100 px: no cabeçalho apertado o modo em uso mantém a palavra e o outro vira ícone com nome acessível", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await entrarNaPagina(page, dono.email, senha);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const ativo = page.locator('[data-testid^="modo-topo-"][aria-pressed="true"]');
    const outro = page.locator('[data-testid^="modo-topo-"][aria-pressed="false"]');
    await expect(ativo).toBeVisible({ timeout: 20_000 });
    const larguraAtivo = (await ativo.boundingBox())!.width;
    const larguraOutro = (await outro.boundingBox())!.width;
    expect(larguraAtivo, "o modo em uso mostra a palavra").toBeGreaterThan(90);
    expect(larguraOutro, "o outro modo é só o ícone").toBeLessThanOrEqual(40);
    await expect(outro).toHaveAccessibleName(/Morador|Proprietário/);
    // Nada do cabeçalho sai da tela nem se sobrepõe.
    const topo = page.locator("header[data-papel]");
    expect(await topo.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    const sino = await topo.locator('[data-testid^="sino-"]').first().boundingBox();
    const pilula = await page.getByTestId("modo-pilula-topo").boundingBox();
    expect(pilula!.x + pilula!.width, "a pílula termina antes do sino").toBeLessThanOrEqual(sino!.x);
  });
});
