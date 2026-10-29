import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T646 — conformidade do assistente de cadastro com os mockups cadastro-imovel-01..10 (29/10): o título do passo fica
  sempre na mesma altura. O estado do rascunho ("Salvando…" / "Salvo às …") mora na linha do selo "Anunciar imóvel",
  e não numa linha própria que nascia no 1º salvamento e empurrava o passo inteiro para baixo no meio da digitação.
  A 1280 e 390 px: o título não se move ao salvar, e fica na mesma altura do 1º ao 7º passo.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t646.${sufixo}@lab.vivanomads.test`, nome: "Lia Titulo", role: "owner" as const };
const ids: Record<string, string> = {};

const topoTitulo = (p: Page) => p.getByTestId("passo-titulo").evaluate((h) => Math.round(h.getBoundingClientRect().top + (document.querySelector("main")?.scrollTop ?? 0) + window.scrollY));

test.describe("T646 — cadastro: o título do passo não pula ao salvar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.r = await criarImovelPronto(ids.dono, `Rascunho t646 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — mesma altura antes e depois do 'Salvo', e do passo 1 ao 7`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await p.goto(`/dashboard/imoveis/novo?draft=${ids.r}&etapa=tipo`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("passo-titulo")).toBeVisible({ timeout: 30_000 });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const noPasso1 = await topoTitulo(p);

      await p.goto(`/dashboard/imoveis/novo?draft=${ids.r}&etapa=descricao`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("cadastro-descricao")).toBeVisible({ timeout: 30_000 });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const antes = await topoTitulo(p);
      await p.getByTestId("cadastro-descricao").fill(`Apartamento mobiliado, pronto para morar, perto do centro (${sufixo}).`);
      const estado = p.getByTestId("estado-salvamento");
      await expect(estado).toHaveText(/Salvo/, { timeout: 20_000 });
      const depois = await topoTitulo(p);
      // O estado mora na linha do selo, à direita (não acima dele).
      const mesmaLinha = await p.evaluate(() => {
        const a = document.querySelector("[data-testid=cadastro-modo]")!.getBoundingClientRect();
        const b = document.querySelector("[data-testid=estado-salvamento]")!.getBoundingClientRect();
        return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) <= 2 && b.left > a.right;
      });
      console.log(`t646|${largura}|${JSON.stringify({ noPasso1, antes, depois, mesmaLinha })}`);
      expect(depois, "o título não se move ao salvar").toBe(antes);
      expect(antes, "mesma altura no passo 1 e no 7").toBe(noPasso1);
      expect(mesmaLinha, "'Salvo' na linha do selo").toBe(true);
      await p.screenshot({ path: `${SAIDA}/t646-descricao-${largura}.png` });
      await p.context().close();
    });
  }
});
