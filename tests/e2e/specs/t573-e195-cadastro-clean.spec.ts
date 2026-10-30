// Portão pós-#1506/#1507 (Pista C, 29/10): E180 (entrada do anúncio novo, cópia local) e E222-B (renovar = aditivo); roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T573 — E195/E166: o cadastro inteiro no mesmo fundo clean (#f7f7f7) — Qualificação, passos do anúncio e /qualificar
  ("Requisitos e selo") — e o primário do rodapé no mesmo verde cheio da Qualificação também quando o passo ainda não
  está pronto (antes, verde-claro). O aviso de anúncio em andamento é um cartão branco. A 390 e 1280 px.
  Reconferência a 390/360 px pedida pelo coordenador (30/10, E195/E238/E219/E229): rodada no lab-crítico sobre a main atual.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t573.${sufixo}@lab.vivanomads.test`, nome: "Clara Clean", role: "owner" as const };
const ids: Record<string, string> = {};
const CLEAN = "rgb(247, 247, 247)";
const VERDE = "rgb(28, 107, 58)";

const fundoNaLateral = (p: Page) =>
  p.evaluate(() => {
    let el = document.elementFromPoint(4, innerHeight / 2) as HTMLElement | null;
    while (el && getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)") el = el.parentElement;
    return el ? getComputedStyle(el).backgroundColor : "";
  });
const primario = (p: Page, testid: string) =>
  p.getByTestId(testid).evaluate((b) => ({ bg: getComputedStyle(b).backgroundColor, op: getComputedStyle(b).opacity }));

test.describe("T573 — E195: cadastro clean e um primário só", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t573 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — Qualificação, Passo 4 e Requisitos e selo`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("qualificacao")).toBeVisible({ timeout: 30_000 });
      const aviso = p.getByTestId("rascunho-aviso");
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      expect(await aviso.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
      expect(await fundoNaLateral(p)).toBe(CLEAN);
      expect(await primario(p, "qualificacao-continuar")).toEqual({ bg: VERDE, op: "1" });
      await p.screenshot({ path: `${SAIDA}/t573-qualificacao-${largura}.png` });

      // Passo 4 de um rascunho incompleto: o primário "não pronto" segue verde cheio.
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=detalhes`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("passo-titulo")).toBeVisible({ timeout: 30_000 });
      expect(await fundoNaLateral(p)).toBe(CLEAN);
      await expect.poll(() => primario(p, "cadastro-continuar"), { timeout: 15_000 }).toEqual({ bg: VERDE, op: "1" });
      await p.screenshot({ path: `${SAIDA}/t573-passo4-${largura}.png` });

      await p.goto(`/qualificar?imovel=${ids.rascunho}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByRole("heading", { name: "Requisitos e selo" })).toBeVisible({ timeout: 30_000 });
      expect(await fundoNaLateral(p)).toBe(CLEAN);
      await p.screenshot({ path: `${SAIDA}/t573-requisitos-${largura}.png` });
      await p.context().close();
    });
  }
});
