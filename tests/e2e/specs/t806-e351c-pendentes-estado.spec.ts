import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, cpfAleatorio, novoSufixo } from "../fixtures/laboratorio";

/*
  T806 — E351 (c), resíduo: na fila de pendentes de /admin/parceiros, cada pedido mostra o estado à vista — "Cadastro
  incompleto · sem …", "Não aprovável ainda · faltam N de M itens do checklist" ou "Pronto para aprovar" — com a borda
  da ficha na cor do estado. 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const sufixo = novoSufixo();
const tudo = { identidade: true, documento: true, area: true, categoria: true, documento_conferido_em: new Date().toISOString() };
const pedidos = [
  { email: `t806.${sufixo}.incompleto@lab.vivanomads.test`, nome: `Lab T806 Incompleto ${sufixo}`, cidades: [] as string[], documento: null as string | null, checklist: {} as Record<string, unknown>, estado: "incompleto", texto: "Cadastro incompleto · sem cidade, CPF/CNPJ" },
  { email: `t806.${sufixo}.meio@lab.vivanomads.test`, nome: `Lab T806 Meio ${sufixo}`, cidades: ["Uberlândia"], documento: cpfAleatorio(), checklist: { identidade: true }, estado: "checklist", texto: "Não aprovável ainda · faltam 4 de 5 itens do checklist" },
  { email: `t806.${sufixo}.pronto@lab.vivanomads.test`, nome: `Lab T806 Pronto ${sufixo}`, cidades: ["Uberlândia"], documento: cpfAleatorio(), checklist: tudo, estado: "pronto", texto: "Pronto para aprovar" },
];

test.describe("T806 — E351 (c): estado do pedido à vista na fila", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    for (const p of pedidos) {
      const { error } = await adm().from("parceiro_solicitacoes").insert({
        email: p.email,
        nome: p.nome,
        tipo_pessoa: "pf",
        documento: p.documento,
        categorias: ["fotografia"],
        cidades: p.cidades,
        status: "pendente",
        origem: "site",
        checklist: p.checklist,
      });
      if (error) throw error;
    }
  });
  test.afterAll(async () => {
    await adm().from("parceiro_solicitacoes").delete().in("email", pedidos.map((p) => p.email));
  });

  for (const largura of [390, 1280] as const) {
    test(`a ${largura} px: selo e borda do estado em cada ficha`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: 900 } });
      const page = await ctx.newPage();
      await page.goto("/admin/parceiros?aba=pendentes&tipo=fotografo", { waitUntil: "domcontentloaded" });
      for (const p of pedidos) {
        const ficha = page.locator(`[data-testid="ficha-parceria"][data-email="${p.email}"]`);
        await expect(ficha).toBeVisible({ timeout: 30_000 });
        await expect(ficha).toHaveAttribute("data-estado", p.estado);
        await expect(ficha.getByTestId("ficha-estado")).toHaveText(p.texto);
        const borda = await ficha.evaluate((e) => getComputedStyle(e).borderLeftWidth);
        expect(parseFloat(borda)).toBeGreaterThanOrEqual(4);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.locator(`[data-testid="ficha-parceria"][data-email="${pedidos[0].email}"]`).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t806-pendentes-${largura}.png` });
      await ctx.close();
    });
  }
});
