import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T664 — E230 (#1540): o score de qualidade do anúncio foi aposentado (decisão do coordenador de 29/10; fecha o L-75).
  Saíram `score.ts`, o cálculo no rascunho, o bloco `anuncio-score` e a t98. A prova permanente de que ele não volta:
  um dono com um rascunho pela metade (o caso em que o score aparecia) abre o Início e Meus imóveis, a 390 e 1280 px,
  e não há `anuncio-score`, `score-dica` nem "Qualidade do anúncio" — com a tela certa na frente (o bloco do rascunho
  e o cartão do anúncio), para o teste não passar numa tela vazia. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t664.${sufixo}@lab.vivanomads.test`, nome: "Sara Sem Score", role: "owner" as const };
const ids: Record<string, string> = {};

const TELAS = [
  { rota: "/dashboard", marca: "inicio-dono-principal", nome: "Início do dono" },
  { rota: "/dashboard/imoveis", marca: "cartao-anuncio-link", nome: "Meus imóveis" },
] as const;

test.describe("T664 — E230: o score do anúncio não aparece mais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    // Rascunho pela metade (sem internet e sem o padrão mínimo): era o estado em que o score e as dicas apareciam.
    ids.r = await criarImovelPronto(ids.dono, `Rascunho sem score t664 ${sufixo}`, { semInternet: true, semConforto: true });
    // E um anúncio no ar, para Meus imóveis ter o cartão (a marca da tela).
    ids.a = await criarImovelPronto(ids.dono, `No ar sem score t664 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — Início e Meus imóveis sem score nem dicas de pontos`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      for (const t of TELAS) {
        await p.goto(t.rota, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId(t.marca).filter({ visible: true }).first(), `${t.nome} @${largura}: a tela aparece`).toBeVisible({ timeout: 30_000 });
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await expect(p.getByTestId("anuncio-score"), `${t.nome} @${largura}: sem o bloco do score`).toHaveCount(0);
        await expect(p.getByTestId("score-dica"), `${t.nome} @${largura}: sem as dicas de pontos`).toHaveCount(0);
        await expect(p.locator("main").first(), `${t.nome} @${largura}: sem "Qualidade do anúncio"`).not.toContainText("Qualidade do anúncio");
      }
      await p.screenshot({ path: `tests/laboratorio/saida/t664-inicio-${largura}.png` });
      await p.context().close();
    });
  }
});
