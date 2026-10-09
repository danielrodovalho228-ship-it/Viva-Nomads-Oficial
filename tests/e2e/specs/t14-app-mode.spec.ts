import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/**
 * T14 — MODO APP (Android/iPhone). Roda no projeto `app-mobile` (390x844 com o
 * user-agent "VivaNomadsApp" que o app nativo acrescenta) e confere a casca:
 * sem marketing, sem navbar/rodapé do site, barra de 5 abas por papel.
 * O último bloco roda no projeto `chromium` (site normal) e garante que NADA
 * disso vaza para o site.
 */

const ABAS_INQUILINO = ["Buscar", "Favoritos", "Candidaturas", "Mensagens", "Conta"];
const ABAS_PROPRIETARIO = ["Painel", "Imóveis", "Interessados", "Mensagens", "Conta"];

function barraDoApp(page: Page) {
  return page.locator("nav.vn-tabbar");
}

async function esperarModoApp(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-app", "1");
}

async function conferirAbas(page: Page, abas: string[]) {
  const barra = barraDoApp(page);
  await expect(barra).toBeVisible();
  for (const aba of abas) await expect(barra.getByRole("link", { name: aba })).toBeVisible();
}

test.describe("T14 — Modo app", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "app-mobile", "só no projeto app-mobile");
  });

  test.describe("anônimo", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("entrar no app: sem Google e com a dica para quem entrou com Google no site", async ({ page }) => {
      await page.goto("/auth");
      await esperarModoApp(page);
      await expect(page.getByTestId("dica-google-app")).toContainText("Esqueci minha senha");
      await expect(page.getByRole("button", { name: /Continuar com Google/ })).toHaveCount(0);
    });

    test("/ e páginas de marketing não existem no app", async ({ page }) => {
      for (const rota of ["/", "/home", "/como-funciona", "/precos"]) {
        await page.goto(rota);
        // Sem sessão: boas-vindas (com Supabase) ou Buscar (modo demonstração).
        await expect(page).toHaveURL(/\/(app\/boas-vindas|buscar)(\?|$)/);
      }
    });

    test("boas-vindas: escolha de papel, sem navbar nem rodapé", async ({ page }) => {
      await page.goto("/app/boas-vindas");
      if (!/boas-vindas/.test(page.url())) test.skip(true, "modo demonstração (sem Supabase)");
      await esperarModoApp(page);
      await expect(page.getByRole("link", { name: /Quero alugar/i })).toHaveAttribute("href", /papel=tenant/);
      await expect(page.getByRole("link", { name: /Quero anunciar/i })).toHaveAttribute("href", /papel=owner/);
      await expect(page.locator("footer")).toBeHidden();
    });

    test("Buscar: cabeçalho do app, sem navbar/rodapé do site", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await esperarModoApp(page);
      await expect(page.locator("footer")).toBeHidden();
      await expect(page.locator("header.app-only-flex")).toBeVisible();
    });
  });

  test.describe("inquilino", () => {
    test.use({ storageState: hasAccount("inquilino") ? authFile("inquilino") : { cookies: [], origins: [] } });

    test("abre em Buscar com as 5 abas do inquilino", async ({ page }) => {
      test.skip(!hasAccount("inquilino"), "sem conta de teste do inquilino");
      await page.goto("/");
      await expect(page).toHaveURL(/\/buscar/);
      await esperarModoApp(page);
      await conferirAbas(page, ABAS_INQUILINO);
    });

    test("Equipe: /admin/agentes dá 404 para inquilino e a aba não aparece", async ({ page }) => {
      test.skip(!hasAccount("inquilino"), "sem conta de teste do inquilino");
      const resp = await page.goto("/admin/agentes");
      expect(resp?.status()).toBe(404);
      await page.goto("/buscar");
      await expect(barraDoApp(page).getByRole("link", { name: "Equipe" })).toHaveCount(0);
    });
  });

  test.describe("admin", () => {
    test.use({ storageState: hasAccount("admin") ? authFile("admin") : { cookies: [], origins: [] } });

    test("Equipe abre /admin/agentes dentro do app, sem rolagem lateral, com notificações e atalhos", async ({ page }) => {
      test.skip(!hasAccount("admin"), "sem conta de teste do admin");
      await page.goto("/dashboard", { waitUntil: "networkidle" });
      await esperarModoApp(page);
      await barraDoApp(page).getByRole("link", { name: "Equipe" }).click();
      await expect(page).toHaveURL(/\/admin\/agentes/);
      await expect(page.getByTestId("central-agentes")).toBeVisible();
      await expect(page.getByTestId("atalhos-app").getByRole("button", { name: /Ativar notifica/ })).toBeVisible();
      await expect(page.getByTestId("atalhos-app").getByRole("link", { name: "Documentos" })).toBeVisible();
      await expect(page.getByTestId("atalhos-app").getByRole("link", { name: "Atendimento" })).toBeVisible();
      // Fica dentro do app: nenhum aviso "Esta parte fica no site".
      await expect(page.getByText("Esta parte fica no site")).toHaveCount(0);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(0);
    });
  });

  test.describe("proprietário", () => {
    test.use({ storageState: hasAccount("proprietario") ? authFile("proprietario") : { cookies: [], origins: [] } });

    test("Conta em lista e as 5 abas do proprietário", async ({ page }) => {
      test.skip(!hasAccount("proprietario"), "sem conta de teste do proprietário");
      await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
      await esperarModoApp(page);
      // Outro spec (T2) alterna o modo desta conta em paralelo: garante o modo.
      const usarComoDono = page.getByRole("button", { name: /Usar como propriet/i });
      if (await usarComoDono.isVisible()) {
        await usarComoDono.click();
        await expect(page).toHaveURL(/\/dashboard\/?$/);
        await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
      }
      await conferirAbas(page, ABAS_PROPRIETARIO);
      await expect(page.getByRole("link", { name: /^Perfil/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Sair/ })).toBeVisible();
      // Casca do site (menu lateral) escondida.
      await expect(page.locator("aside nav").first()).toBeHidden();
    });
  });
});

test.describe("T14 — Site normal continua igual", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
  });

  test("/ não redireciona, tem rodapé e nenhuma marca de app", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("html")).not.toHaveAttribute("data-app", "1");
    await expect(page.locator("footer").first()).toBeVisible();
    await expect(barraDoApp(page)).toBeHidden();
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "vn_app")).toBeUndefined();
  });

  test("/como-funciona continua público no site", async ({ page }) => {
    await page.goto("/como-funciona");
    await expect(page).toHaveURL(/\/como-funciona/);
    await expect(page.locator("footer").first()).toBeVisible();
  });
});
