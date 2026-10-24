import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T92 — Seção "Documento (CPF)" para inquilino e proprietário (ordem c53c86f0, achado do Moacir no #552).
 * Contas NOVAS: em /dashboard/conta e em /dashboard/conta/perfil (subtela do app) a seção
 * data-testid="documento-secao" aparece, a 390 px e a 1280 px, sem rolagem lateral.
 * O link #documento (LINK_DOCUMENTO) cai na subtela Perfil, que existe no app e no site.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const contas = [
  { email: `inq.doc.${sufixo}@lab.vivanomads.test`, nome: "Iara Documento", role: "tenant" as const },
  { email: `dono.doc.${sufixo}@lab.vivanomads.test`, nome: "Otávio Documento", role: "owner" as const },
];
const ids: string[] = [];

test.describe("T92 — Documento (CPF) na Conta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const c of contas) ids.push(await criarConta(c, senha));
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const c of [0, 1]) {
    test(`${c === 0 ? "inquilino" : "proprietário"} vê a seção Documento em /dashboard/conta/dados e no link antigo /dashboard/conta#documento`, async ({ browser }) => {
      test.setTimeout(90_000);
      const page = await entrar(browser, contas[c].email, senha);
      for (const rota of ["/dashboard/conta/dados", "/dashboard/conta#documento"]) {
        for (const largura of [390, 1280]) {
          await page.setViewportSize({ width: largura, height: 844 });
          await page.goto(rota, { waitUntil: "domcontentloaded" });
          const secao = page.getByTestId("documento-secao");
          await expect(secao, `${rota} a ${largura}px`).toBeVisible({ timeout: 20_000 });
          await expect(secao).toContainText(/Documento \(CPF\)|Documento da empresa/);
          const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(sobra, `sem rolagem lateral a ${largura}px`).toBeLessThanOrEqual(1);
        }
      }
      await page.context().close();
    });
  }
});
