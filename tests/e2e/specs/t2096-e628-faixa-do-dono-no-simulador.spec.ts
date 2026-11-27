// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2096 — E628 (Pista 3; varredura "sem spec" das 142, lote B) @E628 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E628): o simulador logado do dono NOMEIA a faixa. O unitário e628-faixa-do-dono.test.ts fixa os nomes
  e a fonte comum; esta spec prova na tela do simulador, a 390 e 1280 px.
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026: lançar SEM o Plano Gestor público de 4%): a escada termina
  em "16–19 imóveis" (6%). Antes a spec cobrava "16–19 imóveis" com 19, e com 20 "20+ imóveis · Plano Gestor", o detalhe
  "Gestor: 20+ imóveis ou administradora · cadastro assistido e contato direto." e a taxa de 4%. Agora o controle vai
  até 16, a fronteira que sobrou é 15 → 16, e a tela não tem detalhe de Gestor nem o nome do plano.
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

test.describe("T2096 — E628/078: o simulador do dono nomeia a faixa; a escada termina em 16–19 imóveis, sem Gestor @E628", () => {
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
    test(`${largura} px — 1, 15 e 16 imóveis: o nome da faixa; a última é 16–19 imóveis a 6%, sem Plano Gestor`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/simulador", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("faixa-nome")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("faixa-nome")).toContainText("1–2 imóveis");
      // 078 (Daniel, 16/11/2026): antes `imoveis(p, 19)` e "16–19 imóveis" — o controle agora vai até 16 e a faixa de
      // baixo da fronteira é a de 6 a 15.
      await imoveis(p, 15);
      await expect(p.getByTestId("faixa-nome")).toContainText("6–15 imóveis");
      await expect(p.getByTestId("taxa-faixa")).toContainText("8%");
      await expect(p.getByTestId("faixa-gestor-detalhe")).toHaveCount(0);
      // 078 (Daniel, 16/11/2026): antes `imoveis(p, 20)`, "20+ imóveis · Plano Gestor", o detalhe do Gestor e "4%".
      await imoveis(p, 16);
      await expect(p.getByTestId("faixa-nome")).toContainText("16–19 imóveis");
      await expect(p.getByTestId("taxa-faixa")).toContainText("6%");
      await expect(p.getByTestId("faixa-gestor-detalhe")).toHaveCount(0);
      await expect(p.getByTestId("faixa-nome")).not.toContainText(/Plano Gestor|Gestor/);
      // O controle não passa de 16: é o início da última faixa da escada.
      await expect(p.locator("#imoveis-ativos")).toHaveAttribute("max", "16");
      await p.context().close();
    });
  }
});
