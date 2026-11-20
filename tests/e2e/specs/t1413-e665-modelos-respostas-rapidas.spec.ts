import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { MODELOS_SUGERIDOS } from "../../../src/lib/respostas/modelos-sugeridos";

/*
  T1413 — E665 (#3086, na main): em /dashboard/respostas-rapidas o dono vê "Modelos para começar" (enxoval, camas, cozinha,
  documentos, regras). Tocar num modelo coloca título e texto no formulário para conferir e EDITAR; nada é salvo sozinho
  (a lista continua vazia) e o texto traz [trechos entre colchetes], nunca valor, prazo, horário ou número. 390 e 1280 px.
*/
const senha = novaSenha();
const dono = { email: `dono.t1413.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora Respostas", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T1413 — E665: modelos de respostas rápidas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("os modelos de dados nunca trazem número e sempre deixam trecho para preencher", () => {
    expect(MODELOS_SUGERIDOS.length).toBeGreaterThanOrEqual(5);
    for (const m of MODELOS_SUGERIDOS) {
      expect(m.texto, `${m.id}: sem número`).not.toMatch(/\d/);
      expect(m.texto, `${m.id}: com trecho entre colchetes`).toMatch(/\[[^\]]+\]/);
    }
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: tocar no modelo preenche o formulário e não salva sozinho`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/respostas-rapidas", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("respostas-modelos")).toBeVisible({ timeout: 30_000 });
      for (const m of MODELOS_SUGERIDOS) await expect(p.getByTestId(`resposta-modelo-${m.id}`)).toBeVisible();
      const m = MODELOS_SUGERIDOS.find((x) => x.id === "enxoval")!;
      await p.getByTestId("resposta-modelo-enxoval").click();
      await expect(p.getByTestId("resposta-titulo")).toHaveValue(m.titulo);
      await expect(p.getByTestId("resposta-texto")).toHaveValue(m.texto);
      // Nada foi salvo: a lista segue vazia.
      await expect(p.getByTestId("resposta-item")).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
