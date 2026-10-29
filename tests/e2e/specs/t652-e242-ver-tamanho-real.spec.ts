import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TITULO_PASSO, noPasso, type PassoCadastro } from "../fixtures/cadastro";

/*
  T652 — E242 (aprovado, parecer msg 63): o "Ver no tamanho real" sai de entre o selo e o título, em TODOS os passos.
   • Guarda: entre o selo e o título só existe o próprio título (o irmão seguinte da linha do selo é o título do passo).
   • 1280: o link fica dentro do cartão da prévia, embaixo da foto (Passos 1–9: prévia lateral; Passo 10: cartão da
     revisão), e não aparece no passo.
   • 390: o link fica no fim do conteúdo do passo, acima do rodapé.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t652.${sufixo}@lab.vivanomads.test`, nome: "Rita Real", role: "owner" as const };
const ids: Record<string, string> = {};
const PASSOS = Object.keys(TITULO_PASSO) as PassoCadastro[];

/** O irmão seguinte da linha do selo e o que existe entre eles. */
const depoisDoSelo = (p: Page) =>
  p.getByTestId("cadastro-linha-selo").evaluate((selo) => {
    const prox = selo.nextElementSibling as HTMLElement | null;
    return { testid: prox?.getAttribute("data-testid") ?? prox?.tagName ?? null, tag: prox?.tagName ?? null };
  });

/** Caixa visível de um elemento (null se escondido). */
const caixa = (p: Page, sel: string) =>
  p.evaluate((s) => {
    const e = Array.from(document.querySelectorAll(s)).find((x) => (x as HTMLElement).offsetParent !== null) as HTMLElement | undefined;
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), left: Math.round(r.left), right: Math.round(r.right) };
  }, sel);

test.describe("T652 — E242: 'Ver no tamanho real' fora de entre o selo e o título", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default", timeout: 300_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1280 px: nos 10 passos, título logo depois do selo; o link no cartão da prévia, embaixo da foto", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    for (const passo of PASSOS) {
      await p.goto(`/dashboard/imoveis/novo?etapa=${passo}`, { waitUntil: "domcontentloaded" });
      await noPasso(p, passo, 30_000);
      expect((await depoisDoSelo(p)).testid, `${passo}: depois do selo`).toBe("passo-titulo");
      const cartao = passo === "revisao" ? "revisao-cartao" : "previa-anuncio";
      const visiveis = p.locator('[data-testid="previa-tamanho-real-abrir"]:visible');
      await expect(visiveis, `${passo}: um link visível`).toHaveCount(1);
      await expect(p.getByTestId(cartao).getByTestId("previa-tamanho-real-abrir"), `${passo}: no cartão`).toBeVisible();
      // Embaixo da foto (o bloco da foto é o irmão anterior) e acima do título do cartão.
      const ordem = await p.getByTestId(cartao).getByTestId("previa-tamanho-real-abrir").evaluate((b) => ({
        antesEhFoto: !!b.previousElementSibling?.querySelector("img, [data-testid='previa-sem-foto'], span"),
        depois: b.nextElementSibling?.getAttribute("data-testid") ?? null,
      }));
      expect(ordem.antesEhFoto, `${passo}: embaixo da foto`).toBe(true);
      expect(ordem.depois, `${passo}: antes do título do cartão`).toBe(passo === "revisao" ? "revisao-titulo" : "previa-titulo");
      if (["tipo", "preco", "revisao"].includes(passo)) await p.screenshot({ path: `${SAIDA}/t652-${passo}-1280.png` });
    }
    await p.context().close();
  });

  test("390 px: nos 10 passos, título logo depois do selo; o link no fim do passo, acima do rodapé", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    for (const passo of PASSOS) {
      await p.goto(`/dashboard/imoveis/novo?etapa=${passo}`, { waitUntil: "domcontentloaded" });
      await noPasso(p, passo, 30_000);
      expect((await depoisDoSelo(p)).testid, `${passo}: depois do selo`).toBe("passo-titulo");
      await expect(p.locator('[data-testid="previa-tamanho-real-abrir"]:visible'), `${passo}: um link visível`).toHaveCount(1);
      const link = p.getByTestId("previa-tamanho-real-passo");
      await expect(link.getByTestId("previa-tamanho-real-abrir")).toBeVisible();
      // O último bloco do passo: nada do formulário depois dele.
      expect(await link.evaluate((e) => e.nextElementSibling === null), `${passo}: no fim do passo`).toBe(true);
      const titulo = await caixa(p, '[data-testid="passo-titulo"]');
      const l = await caixa(p, '[data-testid="previa-tamanho-real-passo"]');
      expect(l!.top, `${passo}: abaixo do título`).toBeGreaterThan(titulo!.bottom);
      // Rolado até o fim, o link fica acima do rodapé fixo (não por baixo dele).
      await link.scrollIntoViewIfNeeded();
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const sobre = await link.getByTestId("previa-tamanho-real-abrir").evaluate((b) => {
        const r = b.getBoundingClientRect();
        const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!topo && b.contains(topo);
      });
      expect(sobre, `${passo}: o rodapé não cobre o link`).toBe(true);
      if (["tipo", "preco", "revisao"].includes(passo)) await p.screenshot({ path: `${SAIDA}/t652-${passo}-390.png` });
    }
    await p.getByTestId("previa-tamanho-real-passo").getByTestId("previa-tamanho-real-abrir").click();
    await expect(p.getByTestId("previa-tamanho-real")).toBeVisible();
    await p.getByTestId("previa-tamanho-real-fechar").click();
    await p.context().close();
  });
});
