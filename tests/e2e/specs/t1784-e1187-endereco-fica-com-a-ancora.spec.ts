import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1784 — E1187 @E1187 (ORDENS-DUET 833, 841, 845 e 850; Central, com a cura na casca).
  Os números de "Para decidir" são âncoras simples (E1184): o salto é do navegador e o roteador não sabe dele. Ao abrir
  uma tela, a casca faz leituras ao servidor (ações de servidor, em fila). Na área da equipe (/admin) cada pedido
  renova o cookie de atividade, e por isso cada leitura conta como "a página mudou": quando responde, o roteador volta
  a escrever o endereço que ele conhece — sem a âncora — e empurra uma entrada a mais no histórico.
  A cura (candidata B, ORDEM-845): um ouvinte na casca conta ao roteador o endereço com a âncora, depois do salto. Não
  toca no toque nem na rolagem.
  O cenário é determinístico: as leituras da sessão são ATRASADAS (cada uma demora mais 1,2 s), a página assenta,
  toca-se, e as leituras respondem DEPOIS do toque. Sem a cura, a âncora cai sempre.
   1. Leituras atrasadas, toque num número de "Para decidir": o endereço fica COM a âncora, o painel fica na tela e o
      toque cria uma só entrada no histórico. Dois números (contestações e auditoria), a 390 px.
   2. O mesmo fora da Central: um salto por âncora feito pelo navegador noutra tela da equipe (/admin/qualidade) —
      a cura é da casca, não de uma página.
   3. O ouvinte é INERTE sem navegação por âncora: abrir a Central, o painel, o início e /como-funciona sem tocar em
      âncora nenhuma não acrescenta escrita nenhuma ao histórico que não seja a do próprio roteador.
   4. Abrir já com a âncora no endereço (link direto): o roteador já a conhece, o ouvinte não escreve nada e o
      endereço continua com a âncora.
  O ouvinte reconhece a entrada do navegador por uma marca interna do Next (`__NA` no estado do histórico). Se uma
  subida do Next mudar a marca ou a ligação do histórico ao roteador, é o caso 1 que cai.
  Sem massa: os números existem com qualquer valor. Sem prints: nenhuma tela muda. Laboratório; não é prova ao vivo.
*/
const ATRASO_MS = 1_200;
type Escrita = { t: number; m: "pushState" | "replaceState"; url: string; doRoteador: boolean };
type Sonda = { escritas: Escrita[]; noToque: { comprimento: number; escritas: number } | null };

/** Abre uma página com a sessão da equipe e uma sonda que regista cada escrita no histórico (e se leva a marca do roteador). */
async function abrir(browser: Browser, caminho: string, opcoes: { atrasarLeituras: boolean; seletorDoToque?: string }): Promise<{ p: Page; leituras: { vistas: number; pendentes: number } }> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((seletor) => {
    const t0 = performance.now();
    const sonda: { escritas: unknown[]; noToque: unknown } = { escritas: [], noToque: null };
    (window as unknown as { __e1187: typeof sonda }).__e1187 = sonda;
    // A sonda fica SEMPRE por fora: o Next troca `history.pushState`/`replaceState` pelas suas versões (é assim que
    // acompanha o histórico) e, quando é ELE a escrever, o estado leva a marca `__NA`. Uma escrita sem a marca vem de
    // fora do roteador — é a do ouvinte. Lida por dentro, a escrita do ouvinte já chegava com a marca copiada.
    let dentro = false;
    for (const m of ["pushState", "replaceState"] as const) {
      type Escrever = (estado: unknown, titulo: string, url?: string | URL | null) => void;
      const gravar = (fn: Escrever): Escrever =>
        function (estado, titulo, url) {
          if (dentro) return fn.call(history, estado, titulo, url);
          dentro = true;
          try {
            sonda.escritas.push({ t: Math.round(performance.now() - t0), m, url: String(url ?? ""), doRoteador: !!(estado && (estado as { __NA?: unknown }).__NA) });
            return fn.call(history, estado, titulo, url);
          } finally {
            dentro = false;
          }
        };
      let atual = gravar(history[m].bind(history) as Escrever);
      Object.defineProperty(history, m, { configurable: true, get: () => atual, set: (fn: Escrever) => (atual = gravar(fn)) });
    }
    if (seletor) {
      document.addEventListener(
        "click",
        (e) => {
          if ((e.target as Element | null)?.closest?.(seletor)) sonda.noToque = { comprimento: history.length, escritas: sonda.escritas.length };
        },
        true,
      );
    }
  }, opcoes.seletorDoToque ?? "");
  const p = await ctx.newPage();
  // As leituras da casca são ações de servidor (pedidos com o cabeçalho `next-action`).
  const leituras = { vistas: 0, pendentes: 0 };
  p.on("request", (r) => {
    if (r.headers()["next-action"]) {
      leituras.vistas++;
      leituras.pendentes++;
    }
  });
  const acabou = (r: { headers(): Record<string, string> }) => {
    if (r.headers()["next-action"]) leituras.pendentes--;
  };
  p.on("requestfinished", acabou);
  p.on("requestfailed", acabou);
  if (opcoes.atrasarLeituras) {
    await p.route("**/*", async (rota) => {
      if (rota.request().headers()["next-action"]) await new Promise((r) => setTimeout(r, ATRASO_MS));
      await rota.continue();
    });
  }
  await p.goto(caminho, { waitUntil: "load" });
  return { p, leituras };
}

const sonda = (p: Page) => p.evaluate(() => (window as unknown as { __e1187: Sonda }).__e1187);
const endereco = (p: Page) => p.evaluate(() => window.location.pathname + window.location.hash);

/** Espera as leituras da casca responderem todas e o roteador deixar de escrever no histórico. */
async function esperarAsLeituras(p: Page, leituras: { vistas: number; pendentes: number }): Promise<void> {
  await expect.poll(() => leituras.vistas > 0 && leituras.pendentes === 0, { message: "as leituras da casca responderam todas", timeout: 30_000 }).toBe(true);
  // A fila de leituras pode pedir a seguinte logo depois de uma responder: só conta quando fica parada.
  await expect
    .poll(
      async () => {
        const antes = { vistas: leituras.vistas, escritas: (await sonda(p)).escritas.length };
        await p.waitForTimeout(700);
        return leituras.pendentes === 0 && leituras.vistas === antes.vistas && (await sonda(p)).escritas.length === antes.escritas;
      },
      { message: "as leituras pararam e o roteador deixou de escrever no histórico", timeout: 30_000 },
    )
    .toBe(true);
}

/** O cenário: leituras atrasadas, página assente, toque na âncora, as leituras respondem depois. */
async function tocarComLeiturasAtrasadas(browser: Browser, caminho: string, seletor: string, ancora: string, nome: string): Promise<void> {
  const { p, leituras } = await abrir(browser, caminho, { atrasarLeituras: true, seletorDoToque: seletor });
  const link = p.locator(seletor).first();
  await expect(link, `${nome}: a âncora está na tela`).toBeVisible({ timeout: 30_000 });
  await expect(link, `${nome}: é uma âncora simples para ${ancora}`).toHaveAttribute("href", ancora);
  await p.waitForTimeout(1_500);
  // O cenário só vale se as leituras ainda não responderam todas quando o toque sai.
  expect(leituras.vistas, `${nome}: a casca faz leituras ao servidor ao abrir`).toBeGreaterThan(0);
  expect(leituras.pendentes, `${nome}: no toque, ainda há leituras da casca por responder`).toBeGreaterThan(0);
  await link.click();
  await expect.poll(() => endereco(p), { message: `${nome}: logo depois do toque, o endereço tem a âncora` }).toBe(caminho + ancora);
  await expect(p.locator(ancora), `${nome}: a secção fica na tela`).toBeInViewport({ timeout: 10_000 });
  await esperarAsLeituras(p, leituras);
  const s = await sonda(p);
  expect(s.noToque, `${nome}: o toque foi registado`).not.toBeNull();
  expect(s.escritas.length, `${nome}: o roteador voltou a escrever o endereço depois do toque (é o momento que o cenário apanha)`).toBeGreaterThan(s.noToque!.escritas);
  expect(await endereco(p), `${nome}: depois de as leituras responderem, o endereço continua COM a âncora`).toBe(caminho + ancora);
  expect((await p.evaluate(() => history.length)) - s.noToque!.comprimento, `${nome}: o toque cria uma só entrada no histórico`).toBe(1);
  const depois = s.escritas.slice(s.noToque!.escritas);
  expect(depois.filter((e) => e.m === "pushState").length, `${nome}: ninguém empurra uma entrada a mais`).toBe(0);
  expect(depois.filter((e) => !e.doRoteador).map((e) => e.m), `${nome}: o ouvinte contou o endereço ao roteador uma vez, sem entrada nova`).toEqual(["replaceState"]);
  await expect(p.locator(ancora), `${nome}: a secção continua na tela`).toBeInViewport();
  await p.context().close();
}

test.describe("T1784 — E1187: o endereço fica com a âncora depois de as leituras da casca responderem @E1187", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  for (const [chave, secao] of [
    ["contestacoes", "contestacoes"],
    ["auditoria", "auditoria"],
  ] as const) {
    test(`1. leituras atrasadas, toque no número "${chave}": o endereço fica com a âncora, o painel na tela e uma só entrada no histórico`, async ({ browser }) => {
      await tocarComLeiturasAtrasadas(browser, "/admin/avaliadores", `[data-testid="decidir-numero-${chave}"]`, `#${secao}`, chave);
    });
  }

  test("2. fora da Central: um salto por âncora feito pelo navegador noutra tela da equipe também fica no endereço", async ({ browser }) => {
    const caminho = "/admin/qualidade";
    const { p, leituras } = await abrir(browser, caminho, { atrasarLeituras: true });
    await expect(p.locator("#correcoes"), "a secção das Correções existe").toHaveCount(1, { timeout: 30_000 });
    await p.waitForTimeout(1_500);
    expect(leituras.pendentes, "no salto, ainda há leituras da casca por responder").toBeGreaterThan(0);
    const antes = { comprimento: await p.evaluate(() => history.length), escritas: (await sonda(p)).escritas.length };
    // O mesmo que seguir uma âncora simples: o navegador muda só a âncora do endereço, sem passar pelo roteador.
    await p.evaluate(() => {
      window.location.hash = "#correcoes";
    });
    await expect.poll(() => endereco(p), { message: "logo depois do salto, o endereço tem a âncora" }).toBe(`${caminho}#correcoes`);
    await esperarAsLeituras(p, leituras);
    const s = await sonda(p);
    expect(s.escritas.length, "o roteador voltou a escrever o endereço depois do salto").toBeGreaterThan(antes.escritas);
    expect(await endereco(p), "depois de as leituras responderem, o endereço continua COM a âncora").toBe(`${caminho}#correcoes`);
    expect((await p.evaluate(() => history.length)) - antes.comprimento, "o salto cria uma só entrada no histórico").toBe(1);
    await p.context().close();
  });

  test("3. sem navegação por âncora o ouvinte é inerte: só o roteador escreve no histórico", async ({ browser }) => {
    for (const caminho of ["/admin/avaliadores", "/dashboard", "/", "/como-funciona"]) {
      const { p, leituras } = await abrir(browser, caminho, { atrasarLeituras: false });
      await esperarAsLeituras(p, leituras);
      const s = await sonda(p);
      expect(s.escritas.filter((e) => !e.doRoteador), `${caminho}: nenhuma escrita no histórico fora das do roteador`).toEqual([]);
      expect(s.escritas.filter((e) => e.m === "pushState"), `${caminho}: nenhuma entrada nova no histórico`).toEqual([]);
      expect(await endereco(p), `${caminho}: o endereço é o que se abriu`).toBe(caminho);
      await p.context().close();
    }
  });

  test("4. link direto já com a âncora: o roteador já a conhece, o ouvinte não escreve nada e o endereço continua com a âncora", async ({ browser }) => {
    const { p, leituras } = await abrir(browser, "/admin/avaliadores#contestacoes", { atrasarLeituras: false });
    await esperarAsLeituras(p, leituras);
    const s = await sonda(p);
    expect(s.escritas.filter((e) => !e.doRoteador), "nenhuma escrita no histórico fora das do roteador").toEqual([]);
    expect(s.escritas.filter((e) => e.m === "pushState"), "nenhuma entrada nova no histórico").toEqual([]);
    expect(await endereco(p), "o endereço continua com a âncora").toBe("/admin/avaliadores#contestacoes");
    await p.context().close();
  });
});
