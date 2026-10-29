import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, cpfAleatorio, novoSufixo } from "../fixtures/laboratorio";

/*
  T658 — E234 (#1520): a idade de um pedido de parceria é UMA conta só nas duas telas do admin — o cartão da aba
  Pendentes (/admin/parceiros, "há N dias") e a linha "pedidos de parceria para aprovar" da Visão geral (/admin,
  "mais antigo há N dias"). Dias inteiros, sem arredondar para cima: um pedido de 900 dias e 14 horas aparece como
  "há 900 dias" nas duas (antes, a Visão geral podia dizer 901). O pedido de teste é o mais antigo do laboratório, então
  é ele que a Visão geral resume. Só no laboratório; o pedido é criado e apagado aqui.
*/
const sufixo = novoSufixo();
const DIA = 86_400_000;
const DIAS = 900;
const email = `t658.${sufixo}@lab.vivanomads.test`;

test.describe("T658 — E234: a idade do pedido de parceria é a mesma em Pendentes e na Visão geral", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ storageState: authFile("admin") });

  test.beforeAll(async () => {
    const { error } = await adm()
      .from("parceiro_solicitacoes")
      .insert({
        email,
        nome: `Lab T658 Pedido Antigo ${sufixo}`,
        tipo_pessoa: "pf",
        documento: cpfAleatorio(),
        categorias: ["fotografia"],
        cidades: ["Uberlândia"],
        status: "pendente",
        origem: "site",
        // 900 dias e 14 horas: o arredondamento para cima daria 901.
        criado_em: new Date(Date.now() - DIAS * DIA - 14 * 3_600_000).toISOString(),
      });
    if (error) throw error;
  });

  test.afterAll(async () => {
    await adm().from("parceiro_solicitacoes").delete().eq("email", email);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — Pendentes e Visão geral dizem "há ${DIAS} dias"`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await page.goto("/admin/parceiros?aba=pendentes", { waitUntil: "domcontentloaded" });
      const dias = page.locator(`[data-testid="ficha-parceria"][data-email="${email}"]`).getByTestId("ficha-dias");
      await expect(dias).toHaveText(`há ${DIAS} dias`, { timeout: 30_000 });
      await expect(dias).toHaveAttribute("data-dias", String(DIAS));

      // A Visão geral mostra as 5 primeiras decisões; a Central (/admin/pendencias) mostra todas, com o mesmo resumo.
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      let linha = page.locator('[data-testid="admin-atencao-item"][data-chave="parceiros_para_aprovar"]');
      if ((await linha.count()) === 0) {
        await page.goto("/admin/pendencias", { waitUntil: "domcontentloaded" });
        linha = page.locator('[data-decisao="parceiros_para_aprovar"]');
      }
      await expect(linha.first()).toContainText(`mais antigo há ${DIAS} dias`, { timeout: 30_000 });
      await expect(linha.first()).not.toContainText(`há ${DIAS + 1} dias`);
      await page.screenshot({ path: `tests/laboratorio/saida/t658-visao-geral-${largura}.png` });
    });
  }
});
