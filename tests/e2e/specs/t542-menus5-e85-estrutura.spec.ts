import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T542 — MENUS-5 / E85, guarda permanente da Pista C, no desenho aprovado (menus-simples, Daniel 24/10; MENUS-5 #1392):
  abas no topo para os dois papéis e barra de baixo no celular, de uma fonte única por papel.
   1. No máximo 5 destinos principais por papel, e a MESMA lista no topo (1280) e na barra de baixo (390) — morador e
      proprietário.
   2. Conta: cada destino com UM nome só. Juntando as abas do topo, o menu da Conta no avatar, o menu lateral da Conta
      (1280) e os cartões da Conta (390), nenhum endereço aparece com dois nomes diferentes.
  As listas lidas vão nas anotações e no log (a evidência quando falha).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t542.${sufixo}@lab.vivanomads.test`, nome: "Mara Menu", role: "tenant" as const };
const dono = { email: `dono.t542.${sufixo}@lab.vivanomads.test`, nome: "Dino Menu", role: "owner" as const };
const ids: Record<string, string> = {};

const caminho = (href: string) => new URL(href, "http://x").pathname.replace(/\/$/, "") || "/";
const primeiraLinha = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "";
const barraDeBaixo = (p: Page) => p.getByRole("navigation", { name: "Navegação principal" });

async function links(page: Page, raiz: string): Promise<[string, string][]> {
  return page.locator(`${raiz} a[href]`).evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => [e.getAttribute("href") ?? "", (e as HTMLElement).innerText] as [string, string]),
  );
}

async function topoEBarra(browser: import("@playwright/test").Browser, email: string, testidAbas: string) {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const topo = p.getByTestId(testidAbas);
  await expect(topo).toBeVisible({ timeout: 30_000 });
  const noTopo = (await topo.locator("a").allInnerTexts()).map(primeiraLinha);
  await p.setViewportSize({ width: 390, height: 844 });
  await expect(barraDeBaixo(p).locator("a").first()).toBeVisible({ timeout: 15_000 });
  const naBarra = (await barraDeBaixo(p).locator("a").allInnerTexts()).map(primeiraLinha);
  await p.context().close();
  return { noTopo, naBarra };
}

test.describe("T542 — MENUS-5 / E85: 5 destinos, fonte única e um nome por destino", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.morador, ids.dono]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio dos menus t542 ${sufixo}`, { ativo: true });
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador, ids.dono]);
  });

  test("1. no máximo 5 destinos por papel e a mesma lista no topo e na barra de baixo", async ({ browser }) => {
    const menus = {
      morador: await topoEBarra(browser, morador.email, "abas-morador"),
      proprietario: await topoEBarra(browser, dono.email, "abas-dono"),
    };
    test.info().annotations.push({ type: "menus", description: JSON.stringify(menus) });
    console.log(`t542 menus ${JSON.stringify(menus)}`);
    for (const [papel, { noTopo, naBarra }] of Object.entries(menus)) {
      expect(noTopo.length, `${papel}: abas do topo ${JSON.stringify(noTopo)}`).toBeGreaterThan(0);
      expect(noTopo.length, `${papel}: abas do topo ${JSON.stringify(noTopo)}`).toBeLessThanOrEqual(5);
      expect(naBarra, `${papel}: a barra de baixo é a mesma lista do topo (fonte única)`).toEqual(noTopo);
    }
  });

  test("2. Conta: cada destino com um nome só (abas, menu da Conta no avatar, menu lateral e cartões)", async ({ browser }) => {
    // E85 (Pista A): lab-crítico 40220134584 — /dashboard/conta/pagamentos é "Pagamentos e recebimentos" no menu da Conta
    // do avatar e "Pagamentos" no menu lateral da Conta e nos cartões. Quem unificar o nome tira este test.fail.
    test.fail(true, "E85: /dashboard/conta/pagamentos com dois nomes (avatar × menu lateral e cartões da Conta)");
    const nomes = new Map<string, Set<string>>();
    const somar = (pares: [string, string][], onde: string) => {
      for (const [href, texto] of pares) {
        if (!href.startsWith("/dashboard")) continue;
        const nome = primeiraLinha(texto);
        if (!nome) continue;
        const c = caminho(href);
        if (!nomes.has(c)) nomes.set(c, new Set());
        nomes.get(c)!.add(`${nome} (${onde})`);
      }
    };
    const page = await entrar(browser, morador.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/conta/notificacoes", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("abas-morador")).toBeVisible({ timeout: 30_000 });
    somar(await links(page, '[data-testid="abas-morador"]'), "abas do topo");
    await page.getByTestId("conta-morador").click();
    await expect(page.getByTestId("menu-conta-morador")).toBeVisible();
    somar(await links(page, '[data-testid="menu-conta-morador"]'), "menu da Conta no avatar");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("conta-menu-lateral")).toBeVisible({ timeout: 20_000 });
    somar(await links(page, '[data-testid="conta-menu-lateral"]'), "menu lateral da Conta");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conta-menu")).toBeVisible({ timeout: 30_000 });
    somar(await links(page, '[data-testid="conta-menu"]'), "cartões da Conta");
    await page.context().close();

    const soNome = (s: string) => s.replace(/ \([^)]*\)$/, "");
    const duplos = [...nomes.entries()].filter(([, v]) => new Set([...v].map(soNome)).size > 1).map(([c, v]) => `${c}: ${[...v].join(" | ")}`);
    test.info().annotations.push({ type: "nomes-duplos", description: JSON.stringify(duplos) });
    console.log(`t542 nomes duplos ${JSON.stringify(duplos)}; destinos lidos ${nomes.size}`);
    expect(nomes.size, "nenhum destino lido (seletores do menu mudaram?)").toBeGreaterThan(3);
    expect(duplos, "destinos alcançáveis por dois nomes diferentes").toEqual([]);
  });
});
