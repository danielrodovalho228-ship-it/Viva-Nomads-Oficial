import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2096 — E628 (Pista 3; varredura "sem spec" das 142, lote B) @E628 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E628, complemento do E564): o simulador logado do dono NOMEIA a faixa — inclusive a do Gestor (20+
  imóveis), com o MESMO texto da /simulacao pública ("Gestor: 20+ imóveis ou administradora · cadastro assistido e
  contato direto"); 19 imóveis ainda é a faixa de 16–19, sem o detalhe do Gestor. O unitário e628-faixa-do-dono.test.ts
  fixa os nomes e a fonte comum; esta spec prova na tela do simulador, a 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2096.${sufixo}@lab.vivanomads.test`, nome: "Dino Faixa", role: "owner" as const };
const ids: Record<string, string> = {};

async function imoveis(p: Page, n: number) {
  const r = p.locator("#imoveis-ativos");
  await r.evaluate((el, v) => {
    const i = el as HTMLInputElement;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(i, String(v));
    i.dispatchEvent(new Event("input", { bubbles: true }));
    i.dispatchEvent(new Event("change", { bubbles: true }));
  }, n);
  await expect(p.getByTestId("imoveis-ativos")).toHaveText(String(n));
}

test.describe("T2096 — E628: o simulador do dono nomeia a faixa, inclusive a do Gestor @E628", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — 1, 19 e 20 imóveis: o nome da faixa; o Gestor só a partir de 20, com o texto da /simulacao`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/simulador", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("faixa-nome")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("faixa-nome")).toContainText("1–2 imóveis");
      await imoveis(p, 19);
      await expect(p.getByTestId("faixa-nome")).toContainText("16–19 imóveis");
      await expect(p.getByTestId("faixa-gestor-detalhe")).toHaveCount(0);
      await imoveis(p, 20);
      await expect(p.getByTestId("faixa-nome")).toContainText("20+ imóveis · Plano Gestor");
      await expect(p.getByTestId("faixa-gestor-detalhe")).toHaveText("Gestor: 20+ imóveis ou administradora · cadastro assistido e contato direto.");
      await expect(p.getByTestId("taxa-faixa")).toContainText("4%");
      await p.context().close();
    });
  }
});
