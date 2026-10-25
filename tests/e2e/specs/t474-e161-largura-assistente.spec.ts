import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TITULO_PASSO, noPasso, type PassoCadastro } from "../fixtures/cadastro";

/*
  T474 — E161: o assistente de cadastro na largura da página do imóvel (e da /dashboard/conta), lado a lado, passo a passo.
   1. Computador (1280 e 1536): nos 10 passos, a área do assistente tem a MESMA largura do conteúdo da página do imóvel
      (régua de 1536 px) e nunca fica mais estreita que o conteúdo da Conta; a prévia lateral tem a largura do cartão
      lateral do anúncio (22rem/26rem).
   2. "Ver no tamanho real": a prévia abre na régua do anúncio, com a foto do tamanho da galeria (480 px de altura).
   3. Celular (390): os 10 passos sem rolagem lateral; o botão "Ver no tamanho real" está no passo e abre a prévia.
  Prints de cada passo e das páginas de referência, para o QA lado a lado.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t474.${sufixo}@lab.vivanomads.test`, nome: "Lia Largura", role: "owner" as const };
const ids: Record<string, string> = {};
const PASSOS = Object.keys(TITULO_PASSO) as PassoCadastro[];
const largura = (p: Page, testid: string) => p.getByTestId(testid).first().evaluate((e) => Math.round(e.getBoundingClientRect().width));

test.describe("T474 — E161: assistente na largura do anúncio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Régua t474 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 1536] as const) {
    test(`1–2. a ${w} px: os 10 passos na régua do anúncio; prévia do tamanho do cartão; tamanho real`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: 900 });

      // As réguas de referência: a página do imóvel e a Conta.
      await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("imovel-largura-total")).toBeVisible({ timeout: 30_000 });
      const imovel = await largura(p, "imovel-largura-total");
      const cartao = await p.locator("#cartao-preco").evaluate((e) => Math.round(e.getBoundingClientRect().width));
      await p.screenshot({ path: `${SAIDA}/t474-ref-imovel-${w}.png` });
      await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      const casca = p.locator("[data-conta-casca]");
      await expect(casca).toBeVisible({ timeout: 30_000 });
      const conta = await casca.evaluate((e) => Math.round(e.getBoundingClientRect().width));
      await p.screenshot({ path: `${SAIDA}/t474-ref-conta-${w}.png` });

      for (const passo of PASSOS) {
        await p.goto(`/dashboard/imoveis/novo?etapa=${passo}`, { waitUntil: "domcontentloaded" });
        await noPasso(p, passo, 30_000);
        const assistente = await largura(p, "assistente-largura");
        expect(Math.abs(assistente - imovel), `${passo}: assistente ${assistente} × imóvel ${imovel}`).toBeLessThanOrEqual(1);
        expect(assistente, `${passo}: assistente ${assistente} × conta ${conta}`).toBeGreaterThanOrEqual(conta);
        if (passo !== "revisao") {
          const previa = await largura(p, "novo-resumo");
          expect(Math.abs(previa - cartao), `${passo}: prévia ${previa} × cartão do anúncio ${cartao}`).toBeLessThanOrEqual(1);
        }
        // O rodapé do fluxo alinha com as bordas da régua: "Voltar"/"Passo N" à esquerda, o primário à direita.
        const borda = await p.getByTestId("assistente-largura").evaluate((e) => {
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return { esq: Math.round(r.left + parseFloat(cs.paddingLeft)), dir: Math.round(r.right - parseFloat(cs.paddingRight)) };
        });
        const linha = await p.locator("[data-rodape-linha]").evaluate((e) => {
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return { esq: Math.round(r.left + parseFloat(cs.paddingLeft)), dir: Math.round(r.right - parseFloat(cs.paddingRight)) };
        });
        expect(Math.abs(linha.esq - borda.esq), `${passo}: rodapé à esquerda (rodapé ${JSON.stringify(linha)} × conteúdo ${JSON.stringify(borda)}, janela ${w})`).toBeLessThanOrEqual(1);
        expect(Math.abs(linha.dir - borda.dir), `${passo}: rodapé à direita (rodapé ${JSON.stringify(linha)} × conteúdo ${JSON.stringify(borda)}, janela ${w})`).toBeLessThanOrEqual(1);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), passo).toBeLessThanOrEqual(1);
        await p.screenshot({ path: `${SAIDA}/t474-passo-${passo}-${w}.png` });
      }

      // 2. O tamanho real, a partir da prévia lateral (Passo 8).
      await p.goto("/dashboard/imoveis/novo?etapa=preco", { waitUntil: "domcontentloaded" });
      await noPasso(p, "preco", 30_000);
      await p.getByTestId("novo-resumo").getByTestId("previa-tamanho-real-abrir").click();
      const real = p.getByTestId("previa-tamanho-real");
      await expect(real).toBeVisible();
      expect(Math.abs((await largura(p, "previa-real-largura")) - imovel)).toBeLessThanOrEqual(1);
      // A galeria do computador (o mosaico); o carrossel do celular fica escondido nesta largura.
      const mosaico = real.getByTestId("galeria-mosaico");
      await expect(mosaico.getByTestId("galeria-tile-0")).toBeVisible();
      const alturaFoto = await mosaico.locator(".h-\\[480px\\]").first().evaluate((e) => Math.round(e.getBoundingClientRect().height));
      expect(alturaFoto).toBe(480);
      expect(Math.abs((await real.locator("#cartao-preco").evaluate((e) => Math.round(e.getBoundingClientRect().width))) - cartao)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t474-tamanho-real-${w}.png` });
      await p.keyboard.press("Escape");
      await expect(real).toHaveCount(0);
      await p.context().close();
    });
  }

  test("3. a 390 px: os 10 passos sem rolagem lateral; 'Ver no tamanho real' no passo", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    for (const passo of PASSOS) {
      await p.goto(`/dashboard/imoveis/novo?etapa=${passo}`, { waitUntil: "domcontentloaded" });
      await noPasso(p, passo, 30_000);
      await expect(p.getByTestId("previa-tamanho-real-passo").getByTestId("previa-tamanho-real-abrir")).toBeVisible();
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), passo).toBeLessThanOrEqual(1);
    }
    await p.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "domcontentloaded" });
    await noPasso(p, "tipo", 30_000);
    await p.getByTestId("previa-tamanho-real-passo").getByTestId("previa-tamanho-real-abrir").click();
    await expect(p.getByTestId("previa-tamanho-real")).toBeVisible();
    expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await p.screenshot({ path: `${SAIDA}/t474-tamanho-real-390.png`, fullPage: true });
    await p.getByTestId("previa-tamanho-real-fechar").click();
    await expect(p.getByTestId("previa-tamanho-real")).toHaveCount(0);
    await p.context().close();
  });
});
