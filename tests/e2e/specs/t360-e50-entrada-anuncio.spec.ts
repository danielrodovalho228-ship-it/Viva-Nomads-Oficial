import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { acharRedundancias } from "../fixtures/redundancia";

/**
 * T360 — E50: a entrada do assistente de anúncio (/dashboard/imoveis/novo) tem UMA apresentação — o banner com o CEP e
 * a IA, que leva o único H1 ("Anunciar seu imóvel em 6 passos"). O título "Anuncie seu imóvel / Em 6 passos…" saiu.
 * O indicador de passos continua. A 390 e 1280 px, com prints (FASE=antes|depois).
 */
const SAIDA = "tests/laboratorio/saida";
const FASE = process.env.T360_FASE ?? "depois";

test.describe("T360 — E50: entrada do anúncio sem título duplicado", () => {
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
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "networkidle" });
      await p.screenshot({ path: `${SAIDA}/t360-${FASE}-entrada-${w}.png` });
      if (FASE === "antes") return p.context().close();
      await expect(p.locator("h1")).toHaveCount(1);
      await expect(p.locator("h1")).toHaveText("Anunciar seu imóvel em 6 passos");
      await expect(p.getByTestId("cadastro-frase-topo")).toContainText("Comece pelo CEP.");
      await expect(p.locator("main")).not.toContainText("Anuncie seu imóvel");
      await expect(p.locator("main")).not.toContainText("Em 6 passos. Salvamos seu progresso automaticamente.");
      // O indicador de passos segue na tela.
      await expect(p.getByTestId(w < 768 ? "etapas-celular" : "etapas-cadastro").first()).toBeVisible();
      // A varredura de redundância (t337) não acha mais o par título × banner.
      const achados = (await acharRedundancias(p)).filter((r) => /anunci/i.test(r.textoA) && /anunci/i.test(r.textoB));
      expect(achados, JSON.stringify(achados)).toEqual([]);
      await p.context().close();
    });
  }
});
