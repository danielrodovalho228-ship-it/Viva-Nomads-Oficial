import { test, expect, devices } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T470 — E135: no Passo 7 (Título e descrição), com título e descrição preenchidos, o "Continuar" AVANÇA para o
  Passo 8; sem título, diz no próprio passo o que falta. Celular de toque (teclado aberto no campo) e computador.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t470.${sufixo}@lab.vivanomads.test`, nome: "Dina Descrição", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T470 — E135: Passo 7 avança", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const tipo of ["celular", "computador"] as const) {
    test(`no ${tipo}: preenchido avança; vazio diz o que falta`, async ({ browser }) => {
      const { defaultBrowserType: _tipo, ...iphone } = devices["iPhone 13"];
      void _tipo;
      const ctx = await browser.newContext(tipo === "celular" ? iphone : { viewport: { width: 1280, height: 900 } });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      await p.goto("/dashboard/imoveis/novo?etapa=descricao", { waitUntil: "domcontentloaded" });
      const aviso = p.getByTestId("rascunho-aviso");
      await expect(p.getByTestId("passo-titulo").or(aviso).first()).toBeVisible({ timeout: 30_000 });
      if (await aviso.isVisible()) {
        await aviso.getByRole("button", { name: "Começar outro" }).click();
        await p.goto("/dashboard/imoveis/novo?etapa=descricao", { waitUntil: "domcontentloaded" });
      }
      await noPasso(p, "descricao", 30_000);

      // Vazio: o clique diz o que falta, no próprio passo.
      await p.getByTestId("cadastro-titulo").fill("");
      await p.getByTestId("cadastro-continuar").click();
      await noPasso(p, "descricao");
      await expect(p.getByText("Dê um título ao anúncio (mín. 3 caracteres).").first()).toBeVisible();

      // Preenchido, com o teclado ainda no campo da descrição: um toque avança.
      await p.getByTestId("cadastro-titulo").fill("Studio mobiliado perto da UFU");
      await p.getByTestId("cadastro-descricao").fill("Studio claro, mobiliado, com internet rápida e cozinha equipada. Perto da universidade e do comércio.");
      await p.getByTestId("cadastro-descricao").focus();
      if (tipo === "celular") await p.getByTestId("cadastro-continuar").tap();
      else await p.getByTestId("cadastro-continuar").click();
      await noPasso(p, "preco", 15_000);
      await p.screenshot({ path: `${SAIDA}/t470-passo8-${tipo}.png` });
      await ctx.close();
    });
  }
});
