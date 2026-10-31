import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T809 — #1761 (QA do Muse, 31/10), Pista C, bloco 126. Meus anúncios: o cartão SEMPRE diz a estadia mínima
  configurada. Com 1 mês, só o rótulo "Estadia mínima (1 mês)" (o total já é o do mês, no próprio cartão); com mais de
  1 mês, a linha com o total e a conta ("Estadia mínima (3 meses): R$ … · …", E254-A). Pela tela de verdade, a 390 e a
  1280 px, com um proprietário novo e dois anúncios publicados (30 e 90 dias de estadia mínima), apagados no fim.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t809.${sufixo}@lab.vivanomads.test`, nome: "Mila Mínima", role: "owner" as const };
const titulos = { umMes: `Studio de 1 mês t809 ${sufixo}`, tresMeses: `Casa de 3 meses t809 ${sufixo}` };
const ids: Record<string, string> = {};

test.describe("T809 — Meus anúncios: o cartão sempre diz a estadia mínima (#1761)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ intencao: ["anunciar"] }).eq("id", ids.dono);
    ids.umMes = await criarImovelPronto(ids.dono, titulos.umMes, { ativo: true });
    ids.tresMeses = await criarImovelPronto(ids.dono, titulos.tresMeses, { ativo: true });
    await adm().from("properties").update({ min_period_days: 30 }).eq("id", ids.umMes);
    await adm().from("properties").update({ min_period_days: 90 }).eq("id", ids.tresMeses);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: 1 mês mostra "Estadia mínima (1 mês)"; 3 meses mostra a linha com o total`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const rodapes = p.getByTestId("anuncio-rodape");
      await expect(rodapes).toHaveCount(2, { timeout: 30_000 });
      // Cada rodapé fica no cartão do seu anúncio: acha o cartão pelo título.
      const cartao = (titulo: string) => p.locator("div.rounded-xl", { hasText: titulo }).filter({ has: p.getByTestId("anuncio-rodape") }).last().getByTestId("anuncio-rodape");
      const um = cartao(titulos.umMes);
      await expect(um).toContainText("Estadia mínima (1 mês)");
      await expect(um).not.toContainText("Estadia mínima (1 mês):");
      const tres = cartao(titulos.tresMeses);
      await expect(tres).toContainText(/Estadia mínima \(3 meses\): R\$\s?[\d.]+,\d{2} · /);
      await p.context().close();
    });
  }
});
