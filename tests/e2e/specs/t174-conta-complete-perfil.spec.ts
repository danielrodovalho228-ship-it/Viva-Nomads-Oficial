import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T174 — "Complete seu perfil" na Conta (correção do #750), a 390 e 1280 px.
  1. Aparece na página completa da Conta (site) e na subtela do app (/dashboard/conta/perfil).
  2. Rótulos acessíveis: o campo da frase chama "Uma frase sobre você" e a dica fica em aria-describedby;
     "Telefone" (Dados pessoais) resolve para um campo só.
  3. Salvar grava de verdade.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `conta.perfil.${sufixo}@lab.vivanomads.test`, nome: "Clara Contaperfil", role: "tenant" as const };
let id: string | undefined;
const SAIDA = "tests/laboratorio/saida";

test.describe("T174 — Complete seu perfil na página completa da Conta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const [largura, rota] of [
    [1280, "/dashboard/conta"],
    [390, "/dashboard/conta"],
    [390, "/dashboard/conta/perfil"],
  ] as const) {
    test(`${largura}px ${rota}: bloco visível, rótulos certos e salvar grava`, async ({ browser }) => {
      const page = await entrar(browser, conta.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto(rota, { waitUntil: "networkidle" });
      const bloco = page.getByTestId("complete-perfil").locator("visible=true");
      await expect(bloco).toHaveCount(1, { timeout: 20_000 });

      // Nome acessível só com o rótulo; a dica (que fala em "telefone") é descrição, não nome.
      const frase = bloco.getByRole("textbox", { name: "Uma frase sobre você", exact: true });
      await expect(frase).toBeVisible();
      await expect(frase).toHaveAttribute("aria-describedby", "perfil-bio-ajuda");
      await expect(bloco.getByRole("textbox", { name: "Cidade onde você mora", exact: true })).toBeVisible();
      if (rota === "/dashboard/conta" && largura === 1280) {
        // Dados pessoais e o perfil público na mesma página: "Telefone" não pode colidir.
        await expect(page.getByLabel("Telefone")).toHaveCount(1);
      }

      const texto = `Pesquisadora ${largura} ${rota.length}.`;
      await frase.fill(texto);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await bloco.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t174-conta-${largura}-${rota.split("/").pop()}.png`, fullPage: false });
      // CONTA-A: no celular o primário é "Salvar e ver imóveis" (preso no fim da tela, leva à busca); no computador, "Salvar perfil".
      if (largura < 1024) {
        await page.getByTestId("perfil-salvar-celular").click();
        await page.waitForURL(/\/buscar/, { timeout: 30_000 });
      } else {
        await bloco.getByRole("button", { name: "Salvar perfil" }).click();
        await expect(bloco.getByRole("status")).toHaveText("Perfil salvo.");
      }
      const { data } = await adm().from("profiles").select("bio").eq("id", id!).single();
      expect(data?.bio).toBe(texto);
      await page.context().close();
    });
  }
});
