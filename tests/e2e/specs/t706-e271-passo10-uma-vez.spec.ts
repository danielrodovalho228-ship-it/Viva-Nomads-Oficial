import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T706 — E271 (QA, 30/10), nas duas larguras (1280 e 390):
   1. Passo 10: com "Declarações do imóvel" e "Documento do imóvel" pendentes, cada uma aparece UMA vez na tela — na
      sua seção de "Antes de publicar" (onde o dono resolve). A lista de conferência não tem mais a linha das
      declarações nem o "Falta: Documento …" embaixo dela; o motivo do botão só conta, sem nomear.
   2. Passo 1: o alt das fotos dos cartões de tipo é neutro ("Foto de uma casa"), sem "ilustrativa".
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t706.${sufixo}@lab.vivanomads.test`, nome: "Uma Vez", role: "owner" as const };
const ids: { dono?: string; rascunho: Record<number, string> } = { rascunho: {} };
const LARGURAS = [1280, 390] as const;

/** Quantas vezes um trecho aparece no texto VISÍVEL da página inteira. */
const vezes = (p: Page, trecho: string) => p.evaluate((t) => document.body.innerText.split(t).length - 1, trecho);

test.describe("T706 — E271: Passo 10 sem pendência repetida; alt neutro no Passo 1", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const l of LARGURAS) ids.rascunho[l] = await prepararRascunho(ids.dono, `Studio t706 ${l} ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of LARGURAS) {
    test(`(1) ${largura} px: declarações e documento aparecem uma vez cada, só na seção delas`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho[largura], "revisao", largura);
      const decl = p.getByTestId("antes-secao-declaracoes");
      const doc = p.getByTestId("antes-secao-documento");
      await expect(decl).toBeVisible({ timeout: 30_000 });
      // As duas pendentes (o rascunho novo não tem documento aprovado nem declarações respondidas).
      await expect(doc).toHaveAttribute("data-estado", "falta");
      if ((await decl.getAttribute("data-estado")) !== "falta") {
        await p.getByTestId("antes-secao-declaracoes-abrir").click();
        await p.getByTestId("convencao-no").click();
        await p.getByTestId("antes-secao-declaracoes-abrir").click();
      }
      await expect(decl).toHaveAttribute("data-estado", "falta");
      await expect(decl).toHaveAttribute("data-aberta", "0");
      await expect(doc).toHaveAttribute("data-aberta", "0");

      // Uma vez cada, na tela inteira do Passo 10 — e é a seção.
      for (const nome of ["Declarações do imóvel", "Documento do imóvel"]) expect(await vezes(p, nome), `"${nome}" uma vez`).toBe(1);
      await expect(decl).toContainText("Declarações do imóvel");
      await expect(doc).toContainText("Documento do imóvel");
      // A lista de conferência não repete: sem a linha das declarações e sem o "Falta: …" do Passo 10.
      const lista = p.getByTestId("lista-conferencia");
      await expect(p.getByTestId("conferencia-tipo")).toHaveCount(0);
      await expect(p.getByTestId("conferencia-revisao")).toHaveCount(0);
      await expect(lista).not.toContainText("Declarações");
      await expect(lista).not.toContainText("Documento");
      // O motivo só conta (as duas seções entram no número), sem nomear.
      const motivo = p.getByTestId("publicar-motivo");
      await expect(motivo).toHaveText(/^Faltam? (\d+) ite(m|ns) antes de publicar( e o aceite do termo da IA)?$/);
      const n = Number((await motivo.innerText()).match(/\d+/)![0]);
      expect(n).toBeGreaterThanOrEqual(Number(await lista.getAttribute("data-faltam")) + 2);
      await expect(motivo).not.toContainText(/declara|documento/i);

      await lista.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t706-passo10-lista-${largura}.png` });
      await p.getByTestId("antes-de-publicar").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t706-passo10-secoes-${largura}.png` });
      await p.context().close();
    });
  }

  for (const largura of LARGURAS) {
    test(`(2) ${largura} px: o alt das fotos de tipo é neutro`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "domcontentloaded" });
      const linha = p.getByRole("radiogroup", { name: "Tipo do imóvel" });
      await expect(linha).toBeVisible({ timeout: 30_000 });
      await expect(linha.locator("img")).toHaveCount(9);
      const alts = await linha.locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("alt") ?? ""));
      for (const alt of alts) {
        expect(alt).toMatch(/^Foto de /);
        expect(alt).not.toMatch(/ilustrativ/i);
      }
      expect(alts).toContain("Foto de uma casa");
      expect(alts).toContain("Foto de um prédio de apartamentos");
      await p.screenshot({ path: `${SAIDA}/t706-passo1-${largura}.png` });
      await p.context().close();
    });
  }
});
