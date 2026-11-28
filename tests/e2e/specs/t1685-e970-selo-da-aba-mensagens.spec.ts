import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { authFile } from "../fixtures/auth";
import { hasAccount, type Role } from "../fixtures/accounts";

/*
  T1685 — E970, a parte da casca (Gerente, ronda 23:49 de 16/11/2026): o selo da aba Mensagens.
  A aba Mensagens aparece nas abas do topo (computador) e na barra inferior (celular). O selo mostra quantas CONVERSAS
  têm pelo menos uma mensagem não lida (ORDEM-DUET-068, ponto 3: a unidade é a conversa).

  O número (`conversasNaoLidas`) é contado pelo servidor no #3892. Este teste cobra só a casca: dado o número que a
  rota dos contadores devolve, a aba mostra o selo certo, no lugar certo. Por isso a resposta da rota é a real, com o
  número trocado pelo do cenário. Que o servidor conta certo, quem cobra é a t2018 (no #3892).

  Enquanto o #3892 não está na main, o painel descarta o campo ao ler a rota (formato fechado dos contadores): não há
  número para mostrar. Os casos "com não lidas" ficam pulados até lá e ligam-se sozinhos quando o campo existir; o caso
  "sem não lidas" roda sempre.
*/
const ROTA = "**/api/painel/contadores**";
const O_PAINEL_LE_O_CONTADOR = /conversasNaoLidas/.test(readFileSync(join(process.cwd(), "src/lib/painel/contadores.ts"), "utf8"));
const SAIDA = "tests/laboratorio/saida";

const PAPEIS: readonly { conta: Role; nome: string; abre: string }[] = [
  { conta: "inquilino", nome: "morador", abre: "/dashboard/favoritos" },
  { conta: "proprietario", nome: "proprietário", abre: "/dashboard/leads" },
];

/** A rota dos contadores responde o que o servidor respondeu, com `n` conversas com não lida. */
async function comConversasNaoLidas(page: Page, n: number): Promise<void> {
  await page.route(ROTA, async (route) => {
    const resposta = await route.fetch();
    const json = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
    await route.fulfill({ response: resposta, json: { ...json, conversasNaoLidas: n } });
  });
}

/** Abre a tela e espera a casca ler os contadores (é dessa leitura que o selo sai). */
async function abrir(page: Page, rota: string): Promise<void> {
  const leitura = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/painel/contadores", { timeout: 30_000 });
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await leitura;
}

const abaDoTopo = (page: Page) => page.locator('header[data-papel] a[href="/dashboard/mensagens"]');
const abaDaBarra = (page: Page) => page.locator('nav[aria-label="Navegação principal"] a[href="/dashboard/mensagens"]');

test.describe("T1685 — E970: o selo da aba Mensagens", () => {
  for (const papel of PAPEIS) {
    test.describe(papel.nome, () => {
      test.skip(!hasAccount(papel.conta), `Sem a conta de teste ${papel.conta}.`);
      test.use({ storageState: authFile(papel.conta) });

      test("a 1280 px, 2 conversas com não lida: a aba do topo mostra o selo 2", async ({ page }) => {
        test.skip(!O_PAINEL_LE_O_CONTADOR, "O contador conversasNaoLidas entra com o #3892; até lá o painel não tem o número.");
        await page.setViewportSize({ width: 1280, height: 900 });
        await comConversasNaoLidas(page, 2);
        await abrir(page, papel.abre);
        const aba = abaDoTopo(page);
        await expect(aba).toBeVisible();
        const selo = aba.locator('[data-testid^="selo-"]');
        await expect(selo).toHaveText("2", { timeout: 15_000 });
        await expect(selo).toBeVisible();
        await expect(selo).toHaveAttribute("aria-label", "2 não lidas");
        // O selo fica dentro da aba, ao lado do rótulo, sem cobri-lo nem sair da faixa do topo.
        const [caixaAba, caixaSelo, caixaTopo] = [await aba.boundingBox(), await selo.boundingBox(), await page.locator("header[data-papel]").boundingBox()];
        expect(caixaAba && caixaSelo && caixaTopo, "medidas").toBeTruthy();
        expect(caixaSelo!.x + caixaSelo!.width, "o selo cabe na aba").toBeLessThanOrEqual(caixaAba!.x + caixaAba!.width + 1);
        expect(caixaSelo!.y >= caixaTopo!.y && caixaSelo!.y + caixaSelo!.height <= caixaTopo!.y + caixaTopo!.height, "o selo cabe na faixa do topo").toBe(true);
        // As outras abas não ganham selo.
        await expect(page.locator('header[data-papel] [data-testid^="selo-"]')).toHaveCount(1);
        await page.screenshot({ path: `${SAIDA}/t1685-e970-selo-${papel.conta}-1280.png` });
      });

      test("a 1280 px, mais de 99: o selo mostra 99+", async ({ page }) => {
        test.skip(!O_PAINEL_LE_O_CONTADOR, "O contador conversasNaoLidas entra com o #3892; até lá o painel não tem o número.");
        await page.setViewportSize({ width: 1280, height: 900 });
        await comConversasNaoLidas(page, 120);
        await abrir(page, papel.abre);
        await expect(abaDoTopo(page).locator('[data-testid^="selo-"]')).toHaveText("99+", { timeout: 15_000 });
      });

      test("a 390 px, 2 conversas com não lida: a aba da barra inferior mostra o selo 2", async ({ page }) => {
        test.skip(!O_PAINEL_LE_O_CONTADOR, "O contador conversasNaoLidas entra com o #3892; até lá o painel não tem o número.");
        await page.setViewportSize({ width: 390, height: 844 });
        await comConversasNaoLidas(page, 2);
        await abrir(page, papel.abre);
        const aba = abaDaBarra(page);
        await expect(aba).toBeVisible();
        const selo = aba.locator('span[aria-label="2 não lidas"]');
        await expect(selo).toHaveText("2", { timeout: 15_000 });
        await expect(selo).toBeVisible();
        await page.screenshot({ path: `${SAIDA}/t1685-e970-selo-${papel.conta}-390.png` });
      });

      for (const [largura, altura] of [[1280, 900], [390, 844]] as const) {
        test(`a ${largura} px, sem conversa com não lida: a aba fica sem selo`, async ({ page }) => {
          await page.setViewportSize({ width: largura, height: altura });
          await comConversasNaoLidas(page, 0);
          await abrir(page, papel.abre);
          const aba = largura === 1280 ? abaDoTopo(page) : abaDaBarra(page);
          await expect(aba).toBeVisible();
          // A leitura dos contadores já chegou (abrir); dá o tempo de um quadro para a casca redesenhar.
          await page.waitForTimeout(500);
          await expect(aba).toHaveText("Mensagens");
          await expect(aba.locator('[data-testid^="selo-"], span[aria-label$="não lidas"]')).toHaveCount(0);
        });
      }
    });
  }
});
