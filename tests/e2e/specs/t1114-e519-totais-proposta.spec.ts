import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1114 — E519 (#2499, 04/11): o passo 1 da proposta ("Pedir para morar") mostra o MESMO total do painel do anúncio,
 * com a preparação e a saída, e a conta aberta. Antes o painel dizia "R$ 8.900 em 2 meses" (aluguel + preparação
 * R$ 450 + saída R$ 250) e a proposta "Total da estadia R$ 8.200 em 2 meses" (só o mês × meses), sem rótulo para os
 * R$ 700. A t357 só acompanhou o rótulo novo ("Total do contrato") no anúncio de exemplo, que não tem essas taxas.
 * Aqui, um anúncio do laboratório com limpeza de preparação R$ 450 e de saída R$ 250, visitante, 390 e 1280:
 *   1. escolhe ~60 dias no calendário → o painel diz "· R$ X em N meses" (N ≥ 2) e a conta com as duas limpezas;
 *   2. "Pedir para morar" → o passo mostra "Total do contrato: R$ X em N meses" — o MESMO X e N do painel — e a
 *      "Conta do total" com "limpeza de preparação R$ 450,00" e "limpeza de saída R$ 250,00", terminando em "= R$ X";
 *   3. os rótulos da casa: "Mensal" e "Total por mês (com contas)"; nada de "Total da estadia" nem "Valor por mês".
 * As regras ficam com o e519-totais-proposta.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1114.${sufixo}@lab.vivanomads.test`, nome: "Lia Totais Prado", role: "owner" as const };
const TITULO = `Studio dos totais E519 ${sufixo}`;
const ids: Record<string, string> = {};
const limpo = (t: string) => t.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

const maisDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Entrada e saída (≈ `dias` depois) livres no calendário de Disponibilidade (como a t357). */
async function escolherNoCalendario(page: Page, dias: number) {
  const livres = page.locator('#disponibilidade button[data-estado-dia="disponivel"]');
  await expect(livres.first()).toBeVisible({ timeout: 20_000 });
  const todos = await livres.evaluateAll((els) => els.map((e) => e.getAttribute("data-dia") ?? ""));
  const livresSet = new Set(todos);
  const entrada = todos.find((d) => livresSet.has(maisDias(d, dias)));
  expect(entrada, "precisa haver um período livre de ~60 dias no calendário").toBeTruthy();
  await page.locator(`#disponibilidade button[data-dia="${entrada}"]`).click();
  await page.locator(`#disponibilidade button[data-dia="${maisDias(entrada!, dias)}"]`).click();
}

test.describe("T1114 — E519: o passo 1 da proposta mostra o total do painel (com preparação e saída)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 4100 });
    const { error } = await adm()
      .from("properties")
      .update({ prep_fee: 450, checkout_cleaning_enabled: true, checkout_cleaning_fee: 250 })
      .eq("id", ids.imovel);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const [largura, altura] of [[1280, 900], [390, 844]] as const) {
    test(`painel e proposta com o mesmo total e a conta das duas limpezas (${largura})`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
      await escolherNoCalendario(page, 59);

      // 1. O painel: "· R$ X em N meses" e a conta com as duas limpezas.
      const card = page.locator("#cartao-preco");
      const estadia = card.getByTestId("cartao-lateral-estadia");
      await expect(estadia).toBeVisible({ timeout: 15_000 });
      const m = limpo(await estadia.innerText()).match(/(R\$ [\d.]+,\d\d) em (\d+) meses/);
      expect(m, `painel: "R$ X em N meses" (${await estadia.innerText()})`).not.toBeNull();
      const [, total, meses] = m!;
      expect(Number(meses)).toBeGreaterThanOrEqual(2);
      const contaPainel = limpo(await card.getByTestId("cartao-lateral-estadia-conta").innerText());
      expect(contaPainel).toContain("limpeza de preparação R$ 450,00");
      expect(contaPainel).toContain("limpeza de saída R$ 250,00");

      // 2. "Pedir para morar": o passo mostra o MESMO total, com a conta aberta.
      const gatilho = largura >= 1024 ? card : page.getByTestId("barra-fixa-imovel");
      await gatilho.getByRole("button", { name: "Pedir para morar", exact: true }).click();
      const passo = page.getByTestId("solicitacao-passo");
      await expect(passo).toBeVisible();
      const texto = limpo(await passo.innerText());
      expect(texto).toContain(`Total do contrato ${total} em ${meses} meses`);
      expect(texto).toMatch(new RegExp(`Conta do total .*limpeza de preparação R\\$ 450,00.*limpeza de saída R\\$ 250,00 = ${total.replace(/[.$]/g, "\\$&")}`));

      // 3. Os rótulos da casa, sem os antigos.
      expect(texto).toContain("Mensal");
      expect(texto).toContain("Total por mês (com contas)");
      expect(texto).not.toContain("Total da estadia");
      expect(texto).not.toContain("Valor por mês");

      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  }
});
