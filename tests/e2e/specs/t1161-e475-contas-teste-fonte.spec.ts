import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1161 — E475 (#2632, 05/11): o número de "Contas de teste" de Admin → Dados de teste é o MESMO de Usuários, pela mesma
 * função (contarUsuarios). Antes, Testes dizia 14 e Usuários 13: as 14 contavam o admin observador da QA (role admin,
 * is_teste), que não está em Usuários. Agora a conta da equipe e as anonimizadas vão num painel à parte. O E475 entrou só
 * com teste de unidade; aqui é a tela, com a sessão de admin do laboratório, 390 e 1280:
 *   1. o número do painel "Contas de teste · N" é igual ao data-teste de numero-fonte-usuarios em /admin/usuarios;
 *   2. uma conta de MORADOR marcada como teste aparece na lista principal (conta-teste), não em "Outras";
 *   3. sem estouro horizontal.
 * Outros specs criam e apagam contas de teste em paralelo: as duas leituras vão juntas, com nova tentativa.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `inq.t1161.${sufixo}@lab.vivanomads.test`, nome: `Tina Teste ${sufixo}`, role: "tenant" as const };
const ids: { morador?: string } = {};

async function numeroDosTestes(page: Page): Promise<number> {
  await page.goto("/admin/dados-de-teste", { waitUntil: "domcontentloaded" });
  const painel = page.getByTestId("contas-teste");
  await expect(painel).toBeVisible({ timeout: 30_000 });
  const m = (await painel.innerText()).match(/Contas de teste · (\d+)/);
  expect(m, "título 'Contas de teste · N'").not.toBeNull();
  return Number(m![1]);
}

async function numeroDeUsuarios(page: Page): Promise<number> {
  await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
  const fonte = page.getByTestId("numero-fonte-usuarios");
  await expect(fonte).toBeVisible({ timeout: 30_000 });
  return Number(await fonte.getAttribute("data-teste"));
}

test.describe("T1161 — E475: Contas de teste e Usuários contam pela mesma fonte", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    const { error } = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.morador);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.morador]);
  });

  for (const w of [390, 1280] as const) {
    test(`o número de Contas de teste é o de Usuários e a moradora de teste está na lista (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        await expect(async () => {
          const testes = await numeroDosTestes(page);
          const usuarios = await numeroDeUsuarios(page);
          expect(testes, `Dados de teste (${testes}) × Usuários (${usuarios})`).toBe(usuarios);
        }).toPass({ timeout: 90_000 });

        await page.goto("/admin/dados-de-teste", { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("contas-teste").getByTestId("conta-teste").filter({ hasText: morador.nome })).toHaveCount(1, { timeout: 20_000 });
        await expect(page.getByTestId("conta-teste-outra").filter({ hasText: morador.nome })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
