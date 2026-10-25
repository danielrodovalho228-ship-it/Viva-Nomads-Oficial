import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T481 — E132-A: a Qualificação (os 12 itens do essencial) vira etapa própria ANTES do Passo 1 do cadastro novo; o
  Passo 1 fica só com o tipo; os requisitos legais viram declarações de um toque no "Antes de publicar" (Passo 10).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t481.${sufixo}@lab.vivanomads.test`, nome: "Quésia Qualifica", role: "owner" as const };
const ids: Record<string, string> = {};

/** Responde as 5 telas com tudo "sim" (12/12) e chega ao Resultado. */
async function responderTudo(p: Page, largura: number) {
  const tela = async (n: number) => {
    await expect(p.getByTestId("qualificacao-progresso")).toHaveText(`Qualificação · ${n} de 5`);
  };
  await tela(1);
  await p.getByTestId("qualificacao-toggle-cama").click();
  await p.getByTestId("qualificacao-toggle-apoio").click();
  await p.getByTestId("qualificacao-opcao-ventilacao-ar").click();
  await p.screenshot({ path: `${SAIDA}/t481-tela1-${largura}.png`, fullPage: true });
  await p.getByTestId("qualificacao-continuar").click();
  await tela(2);
  await p.getByTestId("qualificacao-opcao-cozinha-completa").click();
  await p.getByTestId("qualificacao-opcao-roupa-todos").click();
  await p.screenshot({ path: `${SAIDA}/t481-tela2-${largura}.png`, fullPage: true });
  await p.getByTestId("qualificacao-continuar").click();
  await tela(3);
  await p.getByTestId("qualificacao-toggle-agua").click();
  await p.getByTestId("qualificacao-opcao-lavanderia-imovel").click();
  await p.screenshot({ path: `${SAIDA}/t481-tela3-${largura}.png`, fullPage: true });
  await p.getByTestId("qualificacao-continuar").click();
  await tela(4);
  for (const t of ["luz", "fechadura", "limpa", "mobilia"]) await p.getByTestId(`qualificacao-toggle-${t}`).click();
  await p.screenshot({ path: `${SAIDA}/t481-tela4-${largura}.png`, fullPage: true });
  await p.getByTestId("qualificacao-continuar").click();
  await tela(5);
  await p.getByTestId("qualificacao-mbps").fill("300");
  await p.screenshot({ path: `${SAIDA}/t481-tela5-${largura}.png`, fullPage: true });
  await p.getByTestId("qualificacao-continuar").click();
}

test.describe("T481 — E132-A: Qualificação antes do Passo 1; declarações no Passo 10", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — 5 telas, Resultado 12/12 e o Passo 5 já marcado`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("qualificacao")).toBeVisible({ timeout: 30_000 });
      // Um botão cheio por tela.
      await expect(p.locator('[data-cta="primary"]:visible')).toHaveCount(1);
      await responderTudo(p, largura);
      await expect(p.getByTestId("qualificacao-resultado")).toHaveAttribute("data-faltam", "0");
      await expect(p.getByTestId("qualificacao-resultado-titulo")).toHaveText("Seu imóvel tem o essencial da Viva");
      await expect(p.getByTestId("qualificacao-nivel")).toContainText("Essencial");
      await expect(p.getByTestId("qualificacao-nivel")).not.toContainText(/estimad/i);
      await p.screenshot({ path: `${SAIDA}/t481-resultado-12-${largura}.png`, fullPage: true });

      await p.getByTestId("qualificacao-comecar").click();
      await noPasso(p, "tipo", 30_000);
      await expect(p).toHaveURL(/draft=/);
      // Passo 1 limpo: só o tipo, um botão cheio, os atalhos numa linha de texto.
      await expect(p.getByTestId("tipo-qualificacao")).toHaveCount(0);
      await expect(p.getByTestId("atalhos-passo1")).toBeVisible();
      await expect(p.locator('[data-cta="primary"]:visible')).toHaveCount(1);
      await p.screenshot({ path: `${SAIDA}/t481-passo1-${largura}.png`, fullPage: true });

      // Fonte única: o Passo 5 abre com as respostas marcadas.
      const draft = new URL(p.url()).searchParams.get("draft")!;
      await p.goto(`/dashboard/imoveis/novo?draft=${draft}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "comodidades", 30_000);
      for (const c of ["cama_colchao", "cozinha_basica", "agua_quente", "mobilia_das_fotos"])
        await expect(p.getByTestId(`conforto-item-${c}`).locator("input")).toBeChecked({ timeout: 20_000 });
      await adm().from("properties").delete().eq("id", draft);
      await p.context().close();
    });
  }

  test("faltando itens: título honesto, 'Ver no cadastro' e 'Responder depois' leva ao Passo 1", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("qualificacao")).toBeVisible({ timeout: 30_000 });
    for (let i = 0; i < 5; i++) await p.getByTestId("qualificacao-continuar").click();
    await expect(p.getByTestId("qualificacao-resultado-titulo")).toHaveText("Faltam 12 itens do essencial para publicar");
    await expect(p.getByTestId("qualificacao-resultado-titulo")).not.toContainText(/já pode anunciar/i);
    await p.screenshot({ path: `${SAIDA}/t481-resultado-faltam-390.png`, fullPage: true });
    await p.getByTestId("qualificacao-de-novo").click();
    await p.getByTestId("qualificacao-depois").click();
    await noPasso(p, "tipo", 30_000);
    await p.context().close();
  });

  test("Passo 10: IPTU e água/luz/gás em toggle; convenção só em condomínio; 'Não sei' pendência, 'Não' bloqueia", async ({ browser }) => {
    const apto = await prepararRascunho(ids.dono, `Apto t481 ${sufixo}`, { propertyType: "apartamento" }, 0);
    const casa = await prepararRascunho(ids.dono, `Casa t481 ${sufixo}`, { propertyType: "casa" }, 0);
    for (const largura of [1280, 390] as const) {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/novo?draft=${apto}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "revisao", 30_000);
      const bloco = p.getByTestId("declaracoes-passo10");
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("declaracao-iptu")).toHaveAttribute("role", "switch");
      await p.getByTestId("declaracao-iptu").click();
      await p.getByTestId("declaracao-habitavel").click();
      await expect(p.getByTestId("declaracao-iptu")).toHaveAttribute("aria-checked", "true");
      await expect(p.getByTestId("declaracao-convencao")).toBeVisible();
      await p.getByTestId("convencao-unknown").click();
      await expect(p.getByTestId("convencao-pendencia")).toBeVisible();
      await p.getByTestId("convencao-no").click();
      await expect(p.getByTestId("convencao-bloqueia")).toBeVisible();
      await bloco.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t481-passo10-condominio-${largura}.png`, fullPage: false });
      await p.goto(`/dashboard/imoveis/novo?draft=${casa}&etapa=revisao`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "revisao", 30_000);
      await expect(p.getByTestId("declaracoes-passo10")).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("declaracao-convencao")).toHaveCount(0);
      await p.context().close();
    }
    await adm().from("properties").delete().in("id", [apto, casa]);
  });

  test("/qualificar sem imóvel abre o cadastro novo (a Qualificação)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.goto("/qualificar", { waitUntil: "domcontentloaded" });
    await p.waitForURL((u) => u.pathname === "/dashboard/imoveis/novo", { timeout: 30_000 });
    await expect(p.getByTestId("qualificacao")).toBeVisible({ timeout: 30_000 });
    await p.context().close();
  });
});
