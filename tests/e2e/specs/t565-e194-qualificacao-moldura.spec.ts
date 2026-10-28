import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T565 — E194 (print do Daniel, 25/10): a Qualificação abre DENTRO da moldura do assistente — o mesmo selo "Anunciar
  imóvel" do topo e o mesmo rodapé fixo ("Antes do Passo 1 · Qualificação N de 5", barra contínua, primário). Ao começar
  o cadastro, o Passo 1 segue da barra onde a Qualificação parou (nada recomeça do zero).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t565.${sufixo}@lab.vivanomads.test`, nome: "Mila Moldura", role: "owner" as const };
const ids: Record<string, string> = {};
const barra = (p: import("@playwright/test").Page) => p.getByTestId("assistente-rodape").getByRole("progressbar");

test.describe("T565 — E194: a Qualificação na moldura do assistente", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — selo, rodapé e barra contínua até o Passo 1`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      const comecarOutro = p.getByRole("button", { name: "Começar outro" });
      await expect(p.getByTestId("qualificacao").or(comecarOutro).first()).toBeVisible({ timeout: 30_000 });
      if (await comecarOutro.isVisible()) await comecarOutro.click();
      await expect(p.getByTestId("qualificacao").getByTestId("cadastro-modo")).toHaveText(/Anunciar imóvel/);
      await expect(p.getByTestId("passo-texto")).toHaveText("Antes do Passo 1 · Qualificação 1 de 5");
      let anterior = Number(await barra(p).getAttribute("aria-valuenow"));
      await p.screenshot({ path: `${SAIDA}/t565-qualificacao-1-${largura}.png` });
      for (let n = 2; n <= 5; n++) {
        await p.getByTestId("qualificacao-continuar").click();
        await expect(p.getByTestId("passo-texto")).toHaveText(`Antes do Passo 1 · Qualificação ${n} de 5`);
        const agora = Number(await barra(p).getAttribute("aria-valuenow"));
        expect(agora).toBeGreaterThanOrEqual(anterior);
        anterior = agora;
      }
      await p.getByTestId("qualificacao-continuar").click();
      await expect(p.getByTestId("qualificacao-resultado")).toBeVisible();
      await p.screenshot({ path: `${SAIDA}/t565-resultado-${largura}.png` });
      const fimQualificacao = Number(await barra(p).getAttribute("aria-valuenow"));
      await p.getByTestId("qualificacao-comecar").click();
      await expect(p.getByTestId("passo-texto")).toHaveText("Passo 1 de 10", { timeout: 30_000 });
      expect(Number(await barra(p).getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(fimQualificacao);
      await expect(p.getByTestId("cadastro-modo")).toHaveText(/Anunciar imóvel/);
      await p.screenshot({ path: `${SAIDA}/t565-passo1-${largura}.png` });
      await p.context().close();
    });
  }
});
