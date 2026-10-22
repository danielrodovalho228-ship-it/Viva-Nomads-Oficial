import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T270 — QA do Muse (22/10) sobre o #1025, a 390 px, NA ETAPA DE FOTOS do Anunciar, com rascunhos de 0, 1 e 8 fotos
 * (os mesmos estados de d9117ea9, ea673772 e d68220a3 em produção, que a sessão do laboratório não alcança):
 *   1. rolando a página inteira, nada que passa sob a barra "Fotos: N de 8" fica sem como aparecer inteiro
 *      (régua do Muse, 21/10: controle ou texto sob algo fixo só é defeito se a rolagem não o revela);
 *   2. no fim da rolagem, o último elemento aparece por completo, com respiro (≥ 16 px) acima da barra e do
 *      "Fale com a Viva";
 *   3. o toque em "Adicionar" da barra abre a escolha de arquivos.
 * A t269 (Pista A) cobre a 1ª etapa de um rascunho vazio; esta cobre a etapa de Fotos.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t270.${sufixo}@lab.vivanomads.test`, nome: "Rui Fotos", role: "owner" as const };
const ids: { dono?: string } = {};
const rascunhos: Record<number, string> = {};
const SAIDA = "tests/laboratorio/saida";
const LARGURA = 390;
const ALTURA = 844;
const RESPIRO = 16;

type Medida = {
  topoFixo: number;
  sobABarra: string[];
  naoRevelados: string[];
  ultimo: { nome: string; folga: number } | null;
};

/** Varre a página de cima a baixo e devolve o que passou sob os fixos de baixo, o que nunca aparece inteiro e a folga do fim. */
async function medir(page: Page): Promise<Medida> {
  return page.evaluate(async () => {
    const esperar = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const fixos = () =>
      ['[data-testid="barra-fotos"]', '[data-testid="fale-com-a-viva"]']
        .map((s) => document.querySelector<HTMLElement>(s))
        .filter((el): el is HTMLElement => !!el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden")
        .map((el) => el.getBoundingClientRect());
    const main = document.querySelector("main")!;
    const SEL = "button, input:not([type=hidden]), select, textarea, a[href], label, h1, h2, h3, h4, p, li, img";
    const nome = (el: Element) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? el.getAttribute("alt") ?? "").trim().replace(/\s+/g, " ").slice(0, 40)}"`;
    const itens = Array.from(main.querySelectorAll<HTMLElement>(SEL)).filter((el) => {
      if (el.closest('[data-testid="barra-fotos"], [data-testid="fale-com-a-viva-raiz"], [aria-hidden="true"]')) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.height > 0 && r.width > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    });
    const max = document.documentElement.scrollHeight - innerHeight;
    const passou = new Set<string>();
    const horizontal = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right;
    for (let y = 0; ; y = Math.min(max, y + 150)) {
      scrollTo({ top: y, behavior: "instant" });
      await esperar();
      const fs = fixos();
      for (const el of itens) {
        const r = el.getBoundingClientRect();
        if (fs.some((f) => horizontal(r, f) && r.top < f.bottom && f.top < r.bottom)) passou.add(nome(el));
      }
      if (y >= max) break;
    }
    // Fim da rolagem: posição mais baixa possível. O que não cabe inteiro acima dos fixos aqui, não aparece nunca.
    scrollTo({ top: max, behavior: "instant" });
    await esperar();
    const fs = fixos();
    const topoFixo = Math.min(innerHeight, ...fs.map((f) => f.top));
    const naoRevelados: string[] = [];
    for (const el of itens) {
      const r = el.getBoundingClientRect();
      if (r.height > innerHeight / 2) continue; // maior que meia tela (ex.: galeria inteira) não cabe acima de nada
      const limite = Math.min(innerHeight, ...fs.filter((f) => horizontal(r, f)).map((f) => f.top));
      if (r.bottom > limite) naoRevelados.push(nome(el));
    }
    // Último elemento = o de borda inferior mais baixa.
    let ultimo: Medida["ultimo"] = null;
    const ordenados = itens
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height <= innerHeight / 2)
      .sort((a, b) => b.r.bottom - a.r.bottom);
    if (ordenados.length) {
      const { el, r } = ordenados[0];
      const limite = Math.min(innerHeight, ...fs.filter((f) => horizontal(r, f)).map((f) => f.top));
      ultimo = { nome: nome(el), folga: Math.round(limite - r.bottom) };
    }
    return { topoFixo: Math.round(topoFixo), sobABarra: [...passou], naoRevelados, ultimo };
  });
}

test.describe("T270 — barra de fotos na etapa de Fotos a 390 px (QA do Muse, #1025)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (cria conta e rascunhos).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const n of [0, 1, 8]) {
      const id = await criarImovelPronto(ids.dono, `Studio Fotos ${n} de 8 ${sufixo}`);
      await fotosReais(id, ids.dono);
      if (n < 8) {
        const { data } = await adm().from("property_photos").select("id, sort_order").eq("property_id", id).order("sort_order");
        const sobra = (data ?? []).slice(n).map((f) => f.id as string);
        if (sobra.length) {
          const { error } = await adm().from("property_photos").delete().in("id", sobra);
          if (error) throw error;
        }
      }
      rascunhos[n] = id;
    }
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const n of [0, 1, 8]) {
    test(`rascunho com ${n} de 8 fotos — rolagem inteira, fim com respiro e toque em Adicionar`, async ({ browser }) => {
      test.setTimeout(120_000);
      // Login pela tela; depois a mesma sessão num contexto de celular com toque.
      const login = await entrar(browser, dono.email, senha);
      const sessao = await login.context().storageState();
      await login.context().close();
      const ctx = await browser.newContext({ storageState: sessao, viewport: { width: LARGURA, height: ALTURA }, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      await page.goto(`/dashboard/imoveis/novo?draft=${rascunhos[n]}&etapa=1`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Fotos do imóvel" })).toBeVisible({ timeout: 25_000 });

      const barra = page.getByTestId("barra-fotos");
      await expect(barra).toBeVisible();
      await expect(page.getByTestId("barra-fotos-contador")).toContainText(n >= 8 ? `Fotos: ${n} enviadas` : `Fotos: ${n} de 8`, { timeout: 15_000 });
      await page.waitForTimeout(500); // galeria e "Fale com a Viva" assentam

      const m = await medir(page);
      await page.screenshot({ path: `${SAIDA}/t270-fim-${n}-de-8-390.png` });

      // 3. Toque em "Adicionar": abre a escolha de arquivos em até 3 s.
      const [escolha] = await Promise.all([page.waitForEvent("filechooser", { timeout: 3_000 }), page.getByTestId("barra-fotos-adicionar").tap()]);
      const abriu = !!escolha && escolha.isMultiple();

      // Evidência no log do lab (o artefato nem sempre abre para quem lê).
      console.log(
        `T270 ${n}/8 fotos @390: topo da barra ${m.topoFixo}px; passaram sob a barra ao rolar ${m.sobABarra.length}; ` +
          `sem como aparecer inteiro ${m.naoRevelados.length}${m.naoRevelados.length ? ` (${m.naoRevelados.join("; ")})` : ""}; ` +
          `último elemento ${m.ultimo?.nome ?? "?"} com ${m.ultimo?.folga ?? "?"}px de folga; Adicionar abriu a escolha de arquivos: ${abriu ? "sim" : "não"}`,
      );

      expect(m.naoRevelados, "1. o que passa sob a barra precisa aparecer inteiro em algum ponto da rolagem").toEqual([]);
      expect(m.ultimo?.folga ?? -1, `2. respiro do último elemento (${m.ultimo?.nome}) acima da barra`).toBeGreaterThanOrEqual(RESPIRO);
      expect(abriu, "3. o toque em Adicionar abre a escolha de arquivos (várias fotos)").toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
