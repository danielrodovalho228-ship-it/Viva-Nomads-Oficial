import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T493 — MENUS-5 / E85, guarda permanente da Pista C: a estrutura de menus.
   1. No máximo 5 destinos principais: a barra lateral do morador (1280), as abas do topo do proprietário (1280) e a
      barra inferior dos dois papéis (390).
   2. Conta: cada destino com UM nome só. Juntando a barra lateral (grupos abertos), o menu lateral da Conta (1280) e os
      cartões da Conta no celular (390), nenhum endereço aparece com dois nomes diferentes.
  As listas lidas vão nas anotações e no log (a evidência quando falha).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t493.${sufixo}@lab.vivanomads.test`, nome: "Mara Menu", role: "tenant" as const };
const dono = { email: `dono.t493.${sufixo}@lab.vivanomads.test`, nome: "Dino Menu", role: "owner" as const };
const ids: Record<string, string> = {};

const caminho = (href: string) => new URL(href, "http://x").pathname.replace(/\/$/, "") || "/";
const primeiraLinha = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "";

async function links(page: Page, raiz: string): Promise<[string, string][]> {
  return page.locator(`${raiz} a[href]`).evaluateAll((els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => [e.getAttribute("href") ?? "", (e as HTMLElement).innerText] as [string, string]),
  );
}

test.describe("T493 — MENUS-5 / E85: 5 destinos e um nome por destino", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio dos menus t493 ${sufixo}`, { ativo: true });
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador, ids.dono]);
  });

  test("1. no máximo 5 destinos principais por papel (1280 e 390)", async ({ browser }) => {
    const contagem: Record<string, string[]> = {};
    const pm = await entrar(browser, morador.email, senha);
    await pm.setViewportSize({ width: 1280, height: 900 });
    await pm.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(pm.getByTestId("barra-lateral")).toBeVisible({ timeout: 30_000 });
    contagem["morador-lateral-1280"] = (await pm.getByTestId("barra-lateral").locator('[data-testid="menu-cascata"] > li').allInnerTexts()).map(primeiraLinha);
    await pm.setViewportSize({ width: 390, height: 844 });
    await expect(pm.locator("nav[data-papel]:visible ul > li").first()).toBeVisible({ timeout: 15_000 });
    contagem["morador-barra-390"] = (await pm.locator("nav[data-papel]:visible ul > li").allInnerTexts()).map(primeiraLinha);
    await pm.context().close();

    const pd = await entrar(browser, dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(pd.getByTestId("abas-dono")).toBeVisible({ timeout: 30_000 });
    contagem["dono-topo-1280"] = (await pd.locator('[data-testid^="aba-dono-"]').allInnerTexts()).map(primeiraLinha);
    await pd.setViewportSize({ width: 390, height: 844 });
    await expect(pd.locator("nav[data-papel]:visible ul > li").first()).toBeVisible({ timeout: 15_000 });
    contagem["dono-barra-390"] = (await pd.locator("nav[data-papel]:visible ul > li").allInnerTexts()).map(primeiraLinha);
    await pd.context().close();

    test.info().annotations.push({ type: "menus", description: JSON.stringify(contagem) });
    console.log(`t493 menus ${JSON.stringify(contagem)}`);
    const acima = Object.entries(contagem).filter(([, v]) => v.length > 5 || v.length === 0).map(([k, v]) => `${k}: ${v.length} ${JSON.stringify(v)}`);
    expect(acima, "menus com mais de 5 destinos principais (ou vazios)").toEqual([]);
  });

  test("2. Conta: cada destino com um nome só (barra lateral, menu da Conta e cartões)", async ({ browser }) => {
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
    await expect(page.getByTestId("barra-lateral")).toBeVisible({ timeout: 30_000 });
    // Abre os grupos fechados da barra lateral.
    // Abre um de cada vez: abrir um grupo redesenha a lista (a lista de botões lida antes fica velha).
    const fechado = page.getByTestId("barra-lateral").locator('[data-menu-grupo] > button[aria-expanded="false"]');
    for (let i = 0; i < 12 && (await fechado.count()) > 0; i++) await fechado.first().click();
    somar(await links(page, '[data-testid="barra-lateral"]'), "barra lateral");
    await expect(page.getByTestId("conta-menu-lateral")).toBeVisible({ timeout: 20_000 });
    somar(await links(page, '[data-testid="conta-menu-lateral"]'), "menu da Conta");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conta-menu")).toBeVisible({ timeout: 30_000 });
    somar(await links(page, '[data-testid="conta-menu"]'), "cartões da Conta");
    await page.context().close();

    const soNome = (s: string) => s.replace(/ \([^)]*\)$/, "");
    const duplos = [...nomes.entries()]
      .filter(([, v]) => new Set([...v].map(soNome)).size > 1)
      .map(([c, v]) => `${c}: ${[...v].join(" | ")}`);
    test.info().annotations.push({ type: "nomes-duplos", description: JSON.stringify(duplos) });
    console.log(`t493 nomes duplos ${JSON.stringify(duplos)}`);
    expect(duplos, "destinos alcançáveis por dois nomes diferentes").toEqual([]);
  });
});
