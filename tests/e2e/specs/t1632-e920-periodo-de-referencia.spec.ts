import { test, expect, type Page } from "@playwright/test";
import { SAMPLE_PROPERTIES } from "../../../src/lib/properties";
import { modeloDoCartao } from "../../../src/lib/cartao-modelo";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1632 — E920 (âncora da Família 3; medido pelo Gerente em produção) e E890 (Phoenix, RELATORIO-032).
  A página do imóvel abria com o total do período de referência do cartão e, ao assentar (cerca de 1 s), mudava SOZINHA para outro
  período: "R$ 4.660 em 1 mês" → "R$ 24.460 em 6 meses" no ube-001. Causa: a página lia a duração da última busca guardada no aparelho
  (vn:ultima-busca) depois de carregar. É o mesmo mecanismo do E890 ("o prazo alterna entre carregamentos"): o período dependia do que
  estava guardado no aparelho, não do anúncio nem de uma escolha de quem lê.
  Regra: a página abre E FICA no período de referência (a estadia mínima, como o cartão). Só muda quando a pessoa escolhe as datas.
  390 px (barra fixa do celular) e 1280 px (cartão lateral).
*/
const sem = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const maisDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const br = (iso: string) => iso.split("-").reverse().join("/");
const LARGURAS = [390, 1280] as const;
const altura = (l: number) => (l === 390 ? 844 : 900);
const alvoDoTotal = (page: Page, largura: number) => (largura === 390 ? page.getByTestId("barra-total-estadia") : page.locator("#cartao-preco").getByTestId("cartao-lateral-estadia"));
const guardar = (page: Page, busca: { inicio: string; meses: number; pessoas: number }) => page.addInitScript((b) => localStorage.setItem("vn:ultima-busca", JSON.stringify(b)), busca);

/** Lê o total a cada 250 ms durante `ms` e devolve todos os textos DIFERENTES que apareceram (o assentamento completo). */
async function textosDoTotal(page: Page, largura: number, ms: number): Promise<string[]> {
  const alvo = alvoDoTotal(page, largura);
  await expect(alvo).toBeVisible({ timeout: 40_000 });
  const vistos: string[] = [];
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const t = sem(await alvo.innerText()).replace(/^· /, "");
    if (vistos.at(-1) !== t) vistos.push(t);
    await page.waitForTimeout(250);
  }
  return vistos;
}

test.describe("T1632 — E920: a página abre e fica no período de referência", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const largura of LARGURAS) {
    for (const id of ["ube-001", "ube-003"]) {
      test(`${id} a ${largura} px: com uma busca antiga de 6 meses guardada no aparelho, o total não troca de período ao assentar`, async ({ page }) => {
        test.setTimeout(90_000);
        const p = SAMPLE_PROPERTIES.find((i) => i.id === id)!;
        // O período de referência é o do cartão sem filtro de período: a estadia mínima do anúncio.
        const referencia = sem(modeloDoCartao(p).totalEstadia.texto);
        await page.setViewportSize({ width: largura, height: altura(largura) });
        await guardar(page, { inicio: "", meses: 6, pessoas: 0 });
        await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
        // Assentamento completo: rede parada e mais 5 s de leitura do total (o salto acontecia perto de 1 s).
        const antesDaRede = await textosDoTotal(page, largura, 1_000);
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const depois = await textosDoTotal(page, largura, 5_000);
        expect([...new Set([...antesDaRede, ...depois])], `${id}: o total abre e fica em "${referencia}"`).toEqual([referencia]);
      });
    }

    test(`E890 a ${largura} px: o prazo do total é o mesmo em todo carregamento, com qualquer busca guardada no aparelho`, async ({ browser }) => {
      test.setTimeout(120_000);
      const p = SAMPLE_PROPERTIES.find((i) => i.id === "ube-001")!;
      const referencia = sem(modeloDoCartao(p).totalEstadia.texto);
      const finais: Record<string, string> = {};
      for (const [nome, busca] of [
        ["aparelho novo", null],
        ["busca de 6 meses", { inicio: "", meses: 6, pessoas: 0 }],
        ["busca de 2 meses", { inicio: "", meses: 2, pessoas: 0 }],
        ["busca só com data", { inicio: maisDias(new Date().toISOString().slice(0, 10), 40), meses: 0, pessoas: 2 }],
      ] as const) {
        const ctx = await browser.newContext({ viewport: { width: largura, height: altura(largura) } });
        const page = await ctx.newPage();
        if (busca) await guardar(page, busca);
        await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        finais[nome] = (await textosDoTotal(page, largura, 3_000)).at(-1)!;
        await ctx.close();
      }
      expect(finais, "o mesmo prazo em todos os carregamentos").toEqual({ "aparelho novo": referencia, "busca de 6 meses": referencia, "busca de 2 meses": referencia, "busca só com data": referencia });
    });
  }
});

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1632.${sufixo}@lab.vivanomads.test`, nome: "Dora Referência", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T1632 — E920: o período só muda quando a pessoa escolhe as datas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (anúncio real, com calendário livre).");
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Referência T1632 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    if (NO_LABORATORIO) await apagarContas([ids.dono]);
  });

  for (const largura of LARGURAS) {
    test(`a ${largura} px: fica em "em 1 mês" ao assentar; escolher 60 dias no calendário muda o total; limpar as datas volta à referência`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: largura, height: altura(largura) });
      await guardar(page, { inicio: "", meses: 6, pessoas: 0 });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      const vistos = await textosDoTotal(page, largura, 5_000);
      expect(vistos.length, `sem troca sozinha: ${vistos.join(" → ")}`).toBe(1);
      expect(vistos[0]).toMatch(/^R\$ [\d.]+ em 1 mês$/);
      const referencia = vistos[0];

      // Ação explícita: entrada e saída no calendário (60 dias).
      const livres = page.locator('#disponibilidade button[data-estado-dia="disponivel"]');
      await expect(livres.first()).toBeVisible({ timeout: 20_000 });
      const todos = await livres.evaluateAll((els) => els.map((e) => e.getAttribute("data-dia") ?? ""));
      const livresSet = new Set(todos);
      const entrada = todos.find((d) => livresSet.has(maisDias(d, 60)));
      expect(entrada, "precisa haver 60 dias livres no calendário").toBeTruthy();
      const saida = maisDias(entrada!, 60);
      await page.locator(`#disponibilidade button[data-dia="${entrada}"]`).click();
      // Só a entrada escolhida: o total ainda é o de referência.
      expect(sem(await alvoDoTotal(page, largura).innerText()).replace(/^· /, "")).toBe(referencia);
      await page.locator(`#disponibilidade button[data-dia="${saida}"]`).click();
      await expect(page.getByTestId("calendario-selecao")).toContainText(`${br(entrada!)} → ${br(saida)}`);
      await expect(alvoDoTotal(page, largura), "o total passa a ser o do período escolhido").toContainText("60 dias");
      expect(sem(await alvoDoTotal(page, largura).innerText())).not.toContain("em 1 mês");

      // Limpar as datas: volta ao período de referência.
      await page.locator("#disponibilidade").getByRole("button", { name: "Limpar", exact: true }).click();
      await expect(alvoDoTotal(page, largura)).toContainText("em 1 mês");
      expect(sem(await alvoDoTotal(page, largura).innerText()).replace(/^· /, "")).toBe(referencia);
    });
  }
});
