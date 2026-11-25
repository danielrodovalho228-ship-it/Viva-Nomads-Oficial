import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1782 — E1184 @E1184 (ORDENS-DUET 824, 827 e 830; Central).
  Em /admin/avaliadores, quem tocava num dos oito números de "Para decidir" logo que a página aparecia ficava, em cerca
  de 1 em cada 10 vezes, com o endereço na âncora e a tela parada no topo; o segundo toque não resolvia. Os números eram
  links do roteador a apontar para uma secção da própria página.
  A cura: os oito números são âncoras simples — quem leva a tela até à secção é o navegador.
  Esta trava fixa o MECANISMO, de forma determinística: o toque no número não é tomado pelo roteador (o clique não é
  impedido), e a secção fica na tela. Não tenta apanhar a perda rara do toque cedo: essa está medida no PR (toque
  imediato, muitas vezes), como evidência e não como portão.
   1. Os oito números são âncoras para secções que existem na página.
   2. O toque no número das contestações não é tomado pelo roteador, e o painel fica na tela. A 390 e a 1280 px, com print.
   3. O mesmo para os outros destinos: credenciamento, pedidos sem avaliador, recusas, chave e auditoria.
   4. Voltar ao topo e tocar de novo no mesmo número leva outra vez ao painel.
  O endereço é lido LOGO depois do toque (a âncora já lá está). Não é lido mais tarde de propósito: quando o toque sai
  no primeiro segundo, a própria página volta a escrever o endereço sem a âncora uns décimos de segundo depois (a tela
  rola na mesma). Esse comportamento está descrito no PR, nas dúvidas; aqui só não se deixa que torne a trava instável.
  Sem massa: os números existem com qualquer valor. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const LARGURAS = [390, 1280] as const;
/** chave do número → id da secção de destino. */
const NUMEROS: [string, string][] = [
  ["credenciamentos", "credenciamento"],
  ["sem-avaliador", "sem-avaliador"],
  ["recusas", "recusas"],
  ["chave", "chave"],
  ["contestacoes", "contestacoes"],
  ["devolucoes", "contestacoes"],
  ["laudos-atrasados", "contestacoes"],
  ["auditoria", "auditoria"],
];

type Toque = { impedido: boolean; destino: string | null; endereco: string };

/** Abre a Central com uma sonda que regista, de cada toque num número, se alguém impediu o clique (é o que o roteador faz). */
async function abrirCentral(browser: Browser, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  await ctx.addInitScript(() => {
    const toques: { impedido: boolean; destino: string | null; endereco: string }[] = [];
    (window as unknown as { __toquesNosNumeros: typeof toques }).__toquesNosNumeros = toques;
    document.addEventListener(
      "click",
      (e) => {
        const a = (e.target as Element | null)?.closest?.('[data-testid^="decidir-numero-"]');
        if (!a) return;
        // Lido depois de todos os ouvintes do clique terem corrido e de o navegador ter seguido a âncora.
        setTimeout(() => toques.push({ impedido: e.defaultPrevented, destino: a.getAttribute("href"), endereco: window.location.pathname + window.location.hash }), 0);
      },
      true,
    );
  });
  const p = await ctx.newPage();
  await p.goto("/admin/avaliadores", { waitUntil: "load" });
  await expect(p.getByTestId("avaliacoes-decidir")).toBeVisible({ timeout: 30_000 });
  return p;
}

const toques = (p: Page) => p.evaluate(() => (window as unknown as { __toquesNosNumeros: Toque[] }).__toquesNosNumeros);

/** Toca no número e confere: o clique não foi impedido (o navegador é que navega), o endereço ganhou a âncora logo a seguir e a secção fica na tela. */
async function tocarEConferir(p: Page, chave: string, secao: string, nome: string): Promise<void> {
  const antes = (await toques(p)).length;
  await p.getByTestId(`decidir-numero-${chave}`).click();
  await expect.poll(async () => (await toques(p)).length, { message: `${nome}: o toque foi registado` }).toBe(antes + 1);
  const toque = (await toques(p))[antes];
  expect(toque.destino, `${nome}: o número aponta para a secção`).toBe(`#${secao}`);
  expect(toque.impedido, `${nome}: o toque não é tomado pelo roteador (o clique não é impedido)`).toBe(false);
  expect(toque.endereco, `${nome}: logo depois do toque, o endereço tem a âncora`).toBe(`/admin/avaliadores#${secao}`);
  await expect(p.locator(`#${secao}`), `${nome}: a secção fica na tela`).toBeInViewport({ timeout: 10_000 });
}

/** Espera a rolagem acabar (duas leituras iguais da posição) e devolve onde ficou o topo da secção, em px da tela. */
async function assentar(p: Page, secao: string): Promise<number> {
  await expect
    .poll(
      async () => {
        const antes = await p.evaluate(() => Math.round(window.scrollY));
        await p.waitForTimeout(200);
        return (await p.evaluate(() => Math.round(window.scrollY))) === antes;
      },
      { message: "a rolagem acabou", timeout: 10_000 },
    )
    .toBe(true);
  return p.evaluate((id) => Math.round(document.getElementById(id)!.getBoundingClientRect().top), secao);
}

test.describe("T1782 — E1184: os números de 'Para decidir' são âncoras simples @E1184", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test("1. os oito números são âncoras para secções que existem na página", async ({ browser }) => {
    const p = await abrirCentral(browser, 390);
    await expect(p.locator('[data-testid^="decidir-numero-"]'), "são oito números").toHaveCount(8);
    for (const [chave, secao] of NUMEROS) {
      const numero = p.getByTestId(`decidir-numero-${chave}`);
      await expect(numero, `${chave}: aponta para #${secao}`).toHaveAttribute("href", `#${secao}`);
      expect(await numero.evaluate((el) => el.tagName), `${chave}: é uma âncora`).toBe("A");
      await expect(p.locator(`#${secao}`), `${chave}: a secção #${secao} existe`).toHaveCount(1);
    }
    await p.context().close();
  });

  for (const w of LARGURAS) {
    test(`2. o toque no número das contestações não é tomado pelo roteador, e o painel fica na tela (${w} px)`, async ({ browser }) => {
      const p = await abrirCentral(browser, w);
      await tocarEConferir(p, "contestacoes", "contestacoes", `contestações a ${w} px`);
      await expect(p.getByTestId("avaliacoes-contestacoes"), `a ${w} px: o painel das contestações está na tela`).toBeInViewport();
      // Com a rolagem assente, o título do painel está na metade de cima da tela (não ficou só uma ponta à vista).
      const topo = await assentar(p, "contestacoes");
      expect(topo, `a ${w} px: o topo do painel fica na tela, na metade de cima`).toBeGreaterThanOrEqual(0);
      expect(topo, `a ${w} px: o topo do painel fica na tela, na metade de cima`).toBeLessThanOrEqual((w === 390 ? 844 : 900) / 2);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `sem rolagem lateral a ${w} px`).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t1782-central-contestacoes-${w}.png` });
      await p.context().close();
    });
  }

  test("3. os outros destinos: credenciamento, pedidos sem avaliador, recusas, chave e auditoria", async ({ browser }) => {
    const p = await abrirCentral(browser, 390);
    for (const [chave, secao] of NUMEROS.filter(([, s]) => s !== "contestacoes")) {
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await expect(p.getByTestId(`decidir-numero-${chave}`)).toBeInViewport();
      await tocarEConferir(p, chave, secao, chave);
    }
    await p.context().close();
  });

  test("4. voltar ao topo e tocar de novo no mesmo número leva outra vez ao painel", async ({ browser }) => {
    const p = await abrirCentral(browser, 390);
    await tocarEConferir(p, "contestacoes", "contestacoes", "primeiro toque");
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(p.getByTestId("decidir-numero-contestacoes"), "de volta ao topo").toBeInViewport();
    await expect(p.locator("#contestacoes"), "de volta ao topo, o painel saiu da tela").not.toBeInViewport();
    await tocarEConferir(p, "contestacoes", "contestacoes", "segundo toque");
    await p.context().close();
  });
});
