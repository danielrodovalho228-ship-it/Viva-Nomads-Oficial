import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T712 — E279 (Daniel e Muse, 30/10): o assistente de cadastro (entrada por "Anunciar", a qualificação e os 10 passos)
  fica no fundo CLEAN do site, a 1280 e 390: nenhuma área grande da tela (fundo da página, moldura, coluna, cartões)
  em tom quente/bege. Regra do "quente": vermelho acima do azul em mais de 6 pontos (o bege/areia antigo; o cinza
  clean #f7f7f7 e o branco têm r = g = b). Os elementos de marca pequenos (selo, botão, chips) ficam fora: só entram
  áreas com 25% ou mais da largura da tela e 80 px ou mais de altura.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t712.${sufixo}@lab.vivanomads.test`, nome: "Clara Clean", role: "owner" as const };
const morador = { email: `mor.t712.${sufixo}@lab.vivanomads.test`, nome: "Mia Morador", role: "tenant" as const };
const ids: { dono?: string; morador?: string; rascunho?: string } = {};
const PASSOS = ["tipo", "fotos", "endereco", "detalhes", "comodidades", "regras", "descricao", "preco", "disponibilidade", "revisao"] as const;

/** Áreas grandes com fundo quente (bege/areia), da raiz da página até os cartões. */
async function areasQuentes(p: Page): Promise<string[]> {
  return p.evaluate(() => {
    const quente = (c: string) => {
      const [r, , b, a = 1] = (c.match(/[\d.]+/g) ?? []).map(Number);
      if (a < 0.3 || r === undefined) return false;
      return r - b > 6 && r >= 200;
    };
    const achados: string[] = [];
    const todos = [document.documentElement, document.body, ...Array.from(document.body.querySelectorAll("*"))];
    for (const el of todos) {
      const r = el.getBoundingClientRect();
      if (el !== document.documentElement && el !== document.body && (r.width < innerWidth * 0.25 || r.height < 80)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const img = cs.backgroundImage;
      const corDoGradiente = img && img !== "none" ? (img.match(/rgba?\([^)]+\)/g) ?? []).find(quente) : undefined;
      if (corDoGradiente) achados.push(`${el.tagName.toLowerCase()} gradiente ${corDoGradiente}`);
      if (quente(cs.backgroundColor)) {
        const id = (el as HTMLElement).dataset?.testid;
        achados.push(`${el.tagName.toLowerCase()}${id ? `[${id}]` : ""} ${cs.backgroundColor} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return achados;
  });
}

test.describe("T712 — E279: fundo clean no assistente de cadastro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio t712 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!, ids.morador!]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: entrada por Anunciar, qualificação e os 10 passos sem fundo bege`, async ({ browser }) => {
      const problemas: string[] = [];
      // Entrada pelo "Anunciar" (conta nova cai na qualificação).
      const novo = await entrar(browser, dono.email, senha);
      await novo.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await novo.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await novo.getByTestId("moldura-assistente").waitFor({ timeout: 30_000 });
      await novo.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      for (const a of await areasQuentes(novo)) problemas.push(`entrada: ${a}`);
      const fundo = await novo.getByTestId("moldura-assistente").evaluate((el) => getComputedStyle(el).backgroundColor);
      console.log(`T712|${largura}|entrada|moldura=${fundo}|body=${await novo.evaluate(() => getComputedStyle(document.body).backgroundColor)}`);
      await novo.screenshot({ path: `${SAIDA}/t712-entrada-${largura}.png` });
      await novo.context().close();

      // "Anunciar" do topo sem login (cai no login) e como morador (troca de papel antes do cadastro).
      for (const quem of ["visitante", "morador"] as const) {
        const ctx = quem === "visitante" ? await browser.newContext() : (await entrar(browser, morador.email, senha)).context();
        const q = ctx.pages()[0] ?? (await ctx.newPage());
        await q.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await q.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
        await q.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        const achados = await areasQuentes(q);
        for (const a of achados) problemas.push(`anunciar-${quem} (${new URL(q.url()).pathname}): ${a}`);
        console.log(`T712|${largura}|anunciar-${quem}|${new URL(q.url()).pathname}|${achados.length ? achados.join(" ; ") : "limpo"}`);
        await q.screenshot({ path: `${SAIDA}/t712-anunciar-${quem}-${largura}.png` });
        await ctx.close();
      }

      for (const passo of PASSOS) {
        const p = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, passo, largura);
        const achados = await areasQuentes(p);
        for (const a of achados) problemas.push(`${passo}: ${a}`);
        console.log(`T712|${largura}|${passo}|${achados.length ? achados.join(" ; ") : "limpo"}`);
        await p.screenshot({ path: `${SAIDA}/t712-${passo}-${largura}.png` });
        await p.context().close();
      }
      expect(problemas, "áreas grandes com fundo bege/quente").toEqual([]);
    });
  }
});
