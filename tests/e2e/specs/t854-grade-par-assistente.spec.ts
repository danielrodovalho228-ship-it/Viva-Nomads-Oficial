import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T854 — GRADE PAR NO ASSISTENTE (Pista C, 01/11; merge #1840, varredura do assistente). A regra da casa: numa grade de
  opções, se a última casa for ímpar ela ocupa a linha inteira, sem casa vazia desemparelhada (utilitário grade-par).
  O #1840 trouxe a regra sem teste; aqui, na tela de verdade, a 1280 px (2 colunas; a 390 a grade é de 1 coluna e
  nada muda):
   1) Passo 5 (Comodidades): em toda grade grade-par visível, com nº ímpar de casas a última ocupa a largura da grade;
      com nº par, a última fica na sua coluna;
   2) Passo Preço: "Duração máxima" (90 e 180 dias) em 2 colunas, lado a lado, sem as duas casas vazias da grade de 4.
  Rascunho do laboratório, criado e apagado aqui.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t854.${sufixo}@lab.vivanomads.test`, nome: "Gina Grade", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

async function conferirGradesPares(page: Page): Promise<number> {
  const grades = page.locator(".grade-par");
  await expect(grades.first()).toBeVisible({ timeout: 30_000 });
  const medidas = await grades.evaluateAll((els) =>
    els
      .filter((g) => (g as HTMLElement).offsetParent !== null && g.children.length > 0)
      .map((g) => {
        const filhos = Array.from(g.children) as HTMLElement[];
        const ultimo = filhos[filhos.length - 1].getBoundingClientRect();
        const primeiro = filhos[0].getBoundingClientRect();
        return {
          nome: (g as HTMLElement).dataset.testid ?? g.getAttribute("aria-label") ?? g.className.slice(0, 40),
          casas: filhos.length,
          larguraGrade: Math.round(g.getBoundingClientRect().width),
          larguraUltima: Math.round(ultimo.width),
          larguraPrimeira: Math.round(primeiro.width),
        };
      }),
  );
  expect(medidas.length, "grades grade-par visíveis no passo").toBeGreaterThan(0);
  for (const m of medidas) {
    if (m.casas % 2 === 1 && m.casas > 1) {
      expect(Math.abs(m.larguraUltima - m.larguraGrade), `${m.nome}: ${m.casas} casas, a última ocupa a linha inteira`).toBeLessThanOrEqual(2);
    } else if (m.casas % 2 === 0) {
      expect(Math.abs(m.larguraUltima - m.larguraPrimeira), `${m.nome}: ${m.casas} casas, a última fica na sua coluna`).toBeLessThanOrEqual(2);
    }
  }
  return medidas.length;
}

test.describe("T854 — grade par no assistente (#1840)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio grade par ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("Passo 5: a última casa ímpar de cada grade ocupa a linha inteira (1280 px)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
    const n = await conferirGradesPares(page);
    test.info().annotations.push({ type: "grades", description: `${n} grades grade-par conferidas no Passo 5` });
    await page.context().close();
  });

  test("Passo Preço: 'Duração máxima' em 2 colunas, lado a lado (1280 px)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=preco`, { waitUntil: "domcontentloaded" });
    const grupo = page.getByRole("radiogroup", { name: "Duração máxima" });
    await expect(grupo).toBeVisible({ timeout: 30_000 });
    const [g, a, b] = await Promise.all([grupo.boundingBox(), page.getByTestId("duracao-maxima-90").boundingBox(), page.getByTestId("duracao-maxima-180").boundingBox()]);
    expect(g && a && b, "caixas da grade e das duas opções").toBeTruthy();
    expect(Math.abs(a!.y - b!.y), "90 e 180 dias na mesma linha").toBeLessThanOrEqual(2);
    // Duas colunas ocupam a grade toda: as duas casas somam a largura (menos o espaço entre elas), sem casas vazias.
    expect(a!.width + b!.width, "as duas casas preenchem a linha").toBeGreaterThan(g!.width * 0.9);
    await page.context().close();
  });
});
