import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { acharRedundancias } from "../fixtures/redundancia";
import { noPasso, abrirCadastroNovo } from "../fixtures/cadastro";

/**
 * Rodada da vigia 24/10 (Pista C): confirmação dos merges no lab-crítico do bloco 19 (t354).
 * T364 — E50: a entrada do assistente de anúncio (/dashboard/imoveis/novo) tem UMA apresentação. Nos 10 passos o banner
 * com foto ("Anunciar seu imóvel em 6 passos" / "Comece pelo CEP.") saiu: o único H1 é a pergunta do passo 1 ("Qual é
 * o tipo do seu imóvel?"), com a pílula "Anunciar imóvel" acima. O título "Anuncie seu imóvel / Em 6 passos…" segue
 * fora. O indicador de passos continua ("Passo 1 de 10" e a barra). A 390 e 1280 px, com prints (FASE=antes|depois).
 */
const SAIDA = "tests/laboratorio/saida";
const FASE = process.env.T364_FASE ?? "depois";

test.describe("T364 — E50: entrada do anúncio sem título duplicado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  const senha = novaSenha();
  const dono = { email: `dono.t360.${novoSufixo()}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
  let id = "";
  test.beforeAll(async () => {
    id = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const w of [390, 1280]) {
    test(`a ${w} px`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
      await abrirCadastroNovo(p, "networkidle");
      await p.screenshot({ path: `${SAIDA}/t364-${FASE}-entrada-${w}.png` });
      if (FASE === "antes") return p.context().close();
      await expect(p.locator("h1")).toHaveCount(1);
      await expect(p.locator("h1")).toHaveText("Qual é o tipo do seu imóvel?");
      await expect(p.getByTestId("cadastro-modo")).toHaveText(/Anunciar imóvel/);
      await expect(p.getByTestId("cadastro-apresentacao")).toHaveCount(0);
      await expect(p.locator("main")).not.toContainText("Anuncie seu imóvel");
      await expect(p.locator("main")).not.toContainText(/6 passos/);
      // O indicador de passos segue na tela: "Passo 1 de 10" com a barra de progresso.
      await noPasso(p, "tipo");
      await expect(p.getByRole("progressbar", { name: "Progresso do cadastro" })).toBeVisible();
      // A varredura de redundância (t337) não acha mais o par título × banner.
      const achados = (await acharRedundancias(p)).filter((r) => /anunci/i.test(r.textoA) && /anunci/i.test(r.textoB));
      expect(achados, JSON.stringify(achados)).toEqual([]);
      await p.context().close();
    });
  }
});
