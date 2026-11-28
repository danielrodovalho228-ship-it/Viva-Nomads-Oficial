import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/**
 * T2 — CONTA ÚNICA (@criticos). Antes: persistência do modo Proprietário ⇄ Inquilino.
 * Aposentados em 15/10/2026 (ordem a8c05cd0, PR #506): o seletor de modo e o texto "Modo:" no menu
 * lateral NÃO EXISTEM mais, então os 4 testes de troca/persistência de modo não têm o que provar.
 * Ficam as garantias que continuam valendo: rota de dono abre direto na casca, sem troca de modo,
 * e página pública com sessão não mostra "Entrar".
 *
 * ASSERÇÃO ALTERADA — E900 (julgamento do Gerente, ORDEM-DUET-082 e ronda de 03:20Z de 16/11/2026): o painel voltou a
 * dizer o modo em uso, agora pela PÍLULA do cabeçalho (ícone + palavra do modo + cor própria). O 1º caso deixava de
 * provar alguma coisa: chamava-se "sem seletor de modo" e passava à procura de textos antigos. Agora ele FALHA se a
 * pílula sumir ou perder o ícone, a palavra ou a cor do modo. As formas antigas (o "Modo:" no menu lateral e o botão
 * "Trocar para …") continuam cobradas como ausentes. A troca num toque é do t1667.
 */
const CONTA_T2 = hasAccount("proprietario_pro") ? "proprietario_pro" : "proprietario";

/** E900: a cor do texto e do fundo do modo em uso (globals.css, .modo-pilula). */
const COR_DO_MODO: Record<string, { texto: string; fundo: string; palavra: string }> = {
  morador: { texto: "rgb(28, 107, 58)", fundo: "rgb(227, 241, 232)", palavra: "Morador" },
  proprietario: { texto: "rgb(122, 74, 18)", fundo: "rgb(251, 237, 211)", palavra: "Proprietário" },
  parceiro: { texto: "rgb(29, 79, 145)", fundo: "rgb(226, 236, 249)", palavra: "Parceiro" },
};

// E900: o título era "T2 — Conta única, sem seletor de modo @criticos".
test.describe("T2 — Conta única: o modo em uso à vista na pílula do cabeçalho (E900) @criticos", () => {
  test.describe.configure({ mode: "default" });
  test.use({ storageState: authFile(CONTA_T2) });

  // E900: o título era "não há seletor nem texto de modo no menu lateral".
  test("a pílula do modo está no cabeçalho com ícone, palavra e cor do modo; sem o seletor antigo no menu lateral", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    // E900: UMA pílula à vista (o interruptor de quem tem mais de um papel, ou o selo de quem tem um só).
    const pilula = page.locator('[data-testid^="modo-pilula-"]:visible, [data-testid^="modo-selo-"]:visible');
    await expect(pilula, "a pílula do modo no cabeçalho do painel").toHaveCount(1, { timeout: 20_000 });
    // O modo em uso: um só, com ícone, a palavra do modo à vista e a cor própria (texto e fundo).
    const emUso = pilula.locator('[data-modo][data-ativo="1"]');
    await expect(emUso, "um modo em uso, e só um").toHaveCount(1);
    const modo = (await emUso.getAttribute("data-modo")) ?? "";
    const esperado = COR_DO_MODO[modo];
    expect(esperado, `modo conhecido (veio "${modo}")`).toBeTruthy();
    await expect(emUso.locator("svg"), "ícone do modo").toHaveCount(1);
    await expect(emUso.getByText(esperado.palavra, { exact: true }), "a palavra do modo à vista").toBeVisible();
    await expect(emUso).toHaveCSS("color", esperado.texto);
    await expect(emUso).toHaveCSS("background-color", esperado.fundo);
    // A pílula diz o MESMO modo que a casca está mostrando (abas do topo no computador, barra de baixo no celular).
    const casca = page.locator("header[data-papel]:visible, nav[data-papel]:visible").first();
    await expect(casca).toHaveAttribute("data-papel", modo);
    // Os outros segmentos (se houver) não levam a cor do modo em uso.
    for (const outro of await pilula.locator('[data-modo][data-ativo="0"]').all()) await expect(outro).not.toHaveCSS("background-color", esperado.fundo);
    // PROP-1 (#1337): no computador o dono não tem barra lateral — a casca é o topo com abas (topo-dono).
    await expect(page.locator('aside nav:visible, [data-testid="topo-dono"]:visible').first()).toBeVisible();
    // MENUS-5 (#1392): a casca pode não ter <aside> nenhum; o que vale é nenhum menu lateral com "Modo:".
    await expect(page.locator("aside", { hasText: /Modo:/ })).toHaveCount(0);
    await expect(page.getByTestId("topo-dono")).not.toContainText(/Modo:/);
    await expect(page.getByRole("button", { name: /^Trocar para /i })).toHaveCount(0);
  });

  test("deep-link /dashboard/ferramentas abre dentro da casca, sem redirect", async ({ page }) => {
    await page.goto("/dashboard/ferramentas", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/ferramentas/);
    await expect(page.locator('aside nav:visible, [data-testid="topo-dono"]:visible').first()).toBeVisible();
  });

  test("B3 — página pública com sessão não mostra 'Entrar'", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Meu painel/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Entrar$/ })).toHaveCount(0);
  });
});
