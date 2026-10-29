import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { VERSAO_ORDEM_ETAPAS } from "../../../src/lib/etapas-anuncio";
import { draftKey } from "../../../src/lib/local-keys";

/*
  T641 — E180 (defeito do Daniel em uso real, 28/10). "Anunciar imóvel" / "Novo anúncio" SEMPRE começa na
  Qualificação. O rascunho guardado neste aparelho (de outro anúncio, já com a Qualificação respondida e parado num
  passo) não entra sozinho: é oferecido no aviso "Continuar de onde parei", e só o clique retoma. E o "Sair" do
  assistente é um só: da Qualificação ou de um passo, sempre para Meus imóveis (?saiu=assistente). A 390 e 1280 px.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t641.${sufixo}@lab.vivanomads.test`, nome: "Nina Novo", role: "owner" as const };
const ids: Record<string, string> = {};

/** A cópia local que o assistente guarda: outro anúncio, Qualificação respondida, parado no Passo 4. */
async function deixarRascunhoLocal(p: Page) {
  const snapshot = {
    title: `Studio do outro anúncio t641 ${sufixo}`,
    propertyType: "studio",
    neighborhood: "Centro",
    step: 3,
    etapaMax: 3,
    ordemEtapas: VERSAO_ORDEM_ETAPAS,
    qualificacaoConforto: { status: "respondida", respostas: { cama: true } },
  };
  await p.evaluate(([k, v]) => localStorage.setItem(k, v), [draftKey(ids.dono), JSON.stringify(snapshot)] as const);
}

test.describe("T641 — E180: entrada nova sempre na Qualificação; Sair único", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await adm().from("properties").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — rascunho no aparelho: Qualificação primeiro, retomada só pelo "Continuar de onde parei"`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await deixarRascunhoLocal(p);
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });

      const qual = p.getByTestId("qualificacao");
      await expect(qual).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("qualificacao-progresso")).toContainText("1 de 5");
      await expect(p.getByTestId("passo-titulo")).toHaveCount(0);
      const aviso = qual.getByTestId("rascunho-aviso");
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      await expect(aviso).toContainText("Você tem um anúncio em andamento");
      await expect(aviso.getByTestId("rascunho-continuar")).toHaveText(/Continuar de onde parei/);
      await p.screenshot({ path: `${SAIDA}/t641-entrada-${largura}.png`, fullPage: true });

      // A cópia local continua guardada enquanto a retomada está oferecida (o anúncio novo vazio não a apaga).
      const guardada = await p.evaluate((k) => localStorage.getItem(k), draftKey(ids.dono));
      expect(guardada).toContain(`Studio do outro anúncio t641 ${sufixo}`);

      await aviso.getByTestId("rascunho-continuar").click();
      await expect(p.getByTestId("passo-titulo")).toBeVisible({ timeout: 30_000 });
      await expect(qual).toHaveCount(0);
      await p.screenshot({ path: `${SAIDA}/t641-retomado-${largura}.png` });
      await p.evaluate((k) => localStorage.removeItem(k), draftKey(ids.dono));
      await p.context().close();
    });
  }

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — "Sair" da Qualificação e de um passo: sempre Meus imóveis`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      // 1) Da Qualificação, com uma resposta dada (o "Sair" tenta guardar e sai).
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("qualificacao")).toBeVisible({ timeout: 30_000 });
      await p.getByTestId("qualificacao-opcao-cama-sim").click();
      await p.getByTestId("assistente-sair").click();
      await p.waitForURL(/\/dashboard\/imoveis\?saiu=assistente$/, { timeout: 30_000 });

      // 2) De um passo (Responder depois → Passo 1 → Sair).
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("qualificacao")).toBeVisible({ timeout: 30_000 });
      await p.getByTestId("qualificacao-depois").click();
      await expect(p.getByTestId("passo-titulo")).toBeVisible({ timeout: 30_000 });
      await p.getByTestId("assistente-sair").click();
      await p.waitForURL(/\/dashboard\/imoveis\?saiu=assistente$/, { timeout: 30_000 });
      await p.screenshot({ path: `${SAIDA}/t641-sair-${largura}.png` });
      await p.context().close();
    });
  }
});
