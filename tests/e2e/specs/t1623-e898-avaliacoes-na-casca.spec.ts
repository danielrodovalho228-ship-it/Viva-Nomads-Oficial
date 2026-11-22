import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1623 — E898: Avaliações abre na casca da Conta como as seções irmãs (menu lateral "Conta" com Avaliações ativo no
  computador; "‹ Conta" e o título no celular), com as abas e o conteúdo de antes. A varredura achou o mesmo desvio em
  "Seu perfil público" (subtela do Perfil): também na casca, com Perfil ativo e "← Perfil".
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1623.${sufixo}@lab.vivanomads.test`, nome: "Rita Casca", role: "owner" as const };
const ids: string[] = [];

test.describe("T1623 — E898: Avaliações na casca da Conta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.push(await criarConta(dono, senha));
    await adm().from("profiles").update({ is_teste: true }).in("id", ids);
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  test("1280 px: menu lateral com Avaliações ativo, H1 da casca, abas mantidas", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/avaliacoes", { waitUntil: "domcontentloaded" });
    const menu = p.getByTestId("conta-menu-lateral");
    await expect(menu).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("conta-menu-avaliacoes")).toHaveAttribute("aria-current", "page");
    await expect(menu.locator("[aria-current=page]")).toHaveCount(1);
    await expect(p.getByTestId("conta-h1")).toHaveText("Avaliações");
    await expect(p.locator("h1")).toHaveCount(1);
    await expect(p.locator("[data-conta-casca]")).toHaveAttribute("data-secao", "avaliacoes");
    await expect(p.getByTestId("painel-abas")).toBeVisible();
    for (const aba of ["para-avaliar", "recebidas", "feitas"]) await expect(p.getByTestId(`painel-aba-${aba}`)).toBeVisible();
    await expect(p.getByTestId("conta-fechamento")).toBeVisible();
    // Mesma largura das irmãs: a coluna de conteúdo da casca é igual à de Dados.
    const larguraAvaliacoes = await p.locator("[data-conta-casca] > div.min-w-0").evaluate((e) => Math.round(e.getBoundingClientRect().width));
    await p.screenshot({ path: `${SAIDA}/t1623-avaliacoes-1280.png`, fullPage: true });
    await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("conta-menu-lateral")).toBeVisible({ timeout: 30_000 });
    const larguraDados = await p.locator("[data-conta-casca] > div.min-w-0").evaluate((e) => Math.round(e.getBoundingClientRect().width));
    expect(Math.abs(larguraAvaliacoes - larguraDados)).toBeLessThanOrEqual(2);
    // Do menu lateral para Avaliações e de volta: o menu continua lá.
    await p.getByTestId("conta-menu-avaliacoes").click();
    await expect(p).toHaveURL(/\/dashboard\/avaliacoes$/, { timeout: 30_000 });
    await expect(p.getByTestId("conta-menu-lateral")).toBeVisible();
    await p.context().close();
  });

  test("390 px: '‹ Conta' e o título no topo, sem rolagem lateral; abas mantidas", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/avaliacoes", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("conta-h1")).toHaveText("Avaliações", { timeout: 30_000 });
    await expect(p.getByTestId("conta-menu-lateral")).toBeHidden();
    await expect(p.getByTestId("conta-cabecalho").getByRole("link", { name: /Conta/ })).toBeVisible();
    await expect(p.getByTestId("painel-abas")).toBeVisible();
    expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await p.screenshot({ path: `${SAIDA}/t1623-avaliacoes-390.png`, fullPage: true });
    await p.context().close();
  });

  test("varredura: 'Seu perfil público' também na casca (Perfil ativo, '← Perfil')", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/conta/perfil-publico", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("conta-menu-lateral")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("conta-menu-perfil")).toHaveAttribute("aria-current", "page");
    await expect(p.getByTestId("conta-h1")).toHaveText("Seu perfil público");
    await expect(p.getByTestId("voltar-lista")).toHaveText("← Perfil");
    await p.context().close();
  });
});
