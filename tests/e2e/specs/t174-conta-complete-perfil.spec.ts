import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T174 — "Complete seu perfil" na Conta (correção do #750), a 390 e 1280 px.
  1. Aparece na tela Perfil (/dashboard/conta no computador e /dashboard/conta/perfil; A1).
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
    [1280, "/dashboard/conta/perfil"],
    [390, "/dashboard/conta/perfil"],
  ] as const) {
    test(`${largura}px ${rota}: medidor visível, rótulos certos e salvar grava`, async ({ browser }) => {
      const page = await entrar(browser, conta.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto(rota, { waitUntil: "networkidle" });
      await expect(page.getByTestId("complete-perfil").locator("visible=true")).toHaveCount(1, { timeout: 20_000 });
      // A1 (perfil-01): os campos ficam no cartão "Foto do perfil".
      const cartao = page.getByTestId("perfil-cartao");
      // Nome acessível só com o rótulo; a dica (que fala em "telefone") é descrição, não nome.
      const frase = cartao.getByRole("textbox", { name: "Sobre você", exact: true });
      await expect(frase).toBeVisible();
      await expect(frase).toHaveAttribute("aria-describedby", "perfil-bio-ajuda");
      await expect(cartao.getByRole("textbox", { name: "Cidade onde você mora", exact: true })).toBeVisible();
      // O Perfil não traz os dados pessoais: "Telefone" não aparece aqui (fica em Dados).
      await expect(page.getByLabel("Telefone")).toHaveCount(0);

      const texto = `Pesquisadora ${largura} ${rota.length}.`;
      await frase.fill(texto);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t174-conta-${largura}-${rota.split("/").pop()}.png`, fullPage: false });
      // No celular o "Salvar alterações" fica preso no fim da tela; no computador, no cartão.
      await page.getByTestId(largura < 1024 ? "perfil-salvar-celular" : "perfil-salvar").click();
      await expect(page.getByTestId("perfil-salvar-msg")).toHaveText("Alterações salvas.");
      const { data } = await adm().from("profiles").select("bio").eq("id", id!).single();
      expect(data?.bio).toBe(texto);
      await page.context().close();
    });
  }
});
