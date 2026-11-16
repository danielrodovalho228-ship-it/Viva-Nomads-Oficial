import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1666 — E972: a prévia do perfil ("como te veem") não fica em esqueleto nos primeiros segundos.
  A tela do Perfil já chega pronta do servidor (E789), mas a prévia ainda buscava os dados dela pelo navegador, depois
  de carregar: o formulário aparecia e o cartão ao lado ficava em esqueleto até a resposta voltar.
  Para o morador e para o proprietário (com imóvel), a 1280 e a 390 px:
   • a página que o servidor manda já traz os dados da prévia (antes eles só vinham por um pedido do navegador);
   • amostrando a página a cada mudança e a cada quadro, o esqueleto não aparece nenhuma vez;
   • o cartão é o do papel certo desde o primeiro quadro (E799: nunca chuta o de morador para quem é dono).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t1666.${sufixo}@lab.vivanomads.test`, nome: "Mara Espelho", role: "tenant" as const };
const dono = { email: `dono.t1666.${sufixo}@lab.vivanomads.test`, nome: "Davi Espelho", role: "owner" as const };
const ids: { morador?: string; dono?: string } = {};

declare global {
  interface Window {
    __amostrasDaPrevia?: { esqueleto: boolean; cartao: string | null }[];
  }
}

/** Antes de qualquer script da página: guarda, a cada mudança e a cada quadro, se a prévia está em esqueleto. */
async function amostrarPrevia(page: Page) {
  await page.addInitScript(() => {
    const amostras: { esqueleto: boolean; cartao: string | null }[] = [];
    window.__amostrasDaPrevia = amostras;
    const visivel = (e: Element) => e.getClientRects().length > 0;
    const ver = () => {
      const esqueleto = [...document.querySelectorAll('[data-testid="espelho-carregando"]')].some(visivel);
      const papel = [...document.querySelectorAll('[data-testid="espelho-papel"]')].find(visivel);
      amostras.push({ esqueleto, cartao: papel ? papel.getAttribute("data-papel") : null });
    };
    new MutationObserver(ver).observe(document, { childList: true, subtree: true, attributes: true });
    const quadro = () => {
      ver();
      requestAnimationFrame(quadro);
    };
    quadro();
  });
}

test.describe("T1666 — E972: a prévia do perfil chega pronta do servidor", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.dono = await criarConta(dono, senha);
    await criarImovelPronto(ids.dono, `Studio espelho ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador, ids.dono]);
  });

  const casos = [
    { quem: "morador", conta: morador, papel: "morador" },
    { quem: "proprietário com imóvel", conta: dono, papel: "proprietario" },
  ] as const;
  for (const largura of [1280, 390]) {
    for (const c of casos) {
      test(`${largura} px, ${c.quem}: os dados da prévia vêm com a página e o esqueleto não aparece em nenhum quadro`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: 900 });
        await entrarNaPagina(page, c.conta.email, senha);
        // A tela do Perfil é desenhada no navegador com os dados que a página traz embutidos: a prévia vem neles.
        const html = await (await page.request.get("/dashboard/conta/perfil")).text();
        expect.soft(html, "a página já traz os dados da prévia, lidos no servidor").toMatch(/previaInicial\\*":\{\\*"nome/);
        expect.soft(html, `a prévia do servidor diz se a pessoa é dona (${c.quem})`).toMatch(new RegExp(`ehDono\\\\*":${c.papel === "proprietario"}`));
        await amostrarPrevia(page);
        await page.goto("/dashboard/conta/perfil", { waitUntil: "load" });
        await expect(page.locator('[data-testid="espelho-papel"]:visible').first()).toHaveAttribute("data-papel", c.papel, { timeout: 20_000 });
        await page.waitForTimeout(1_500);
        const lista = await page.evaluate(() => window.__amostrasDaPrevia ?? []);
        expect(lista.length).toBeGreaterThan(5);
        expect(lista.filter((a) => a.esqueleto).length, `amostras com a prévia em esqueleto (de ${lista.length})`).toBe(0);
        // Desde que a prévia existe na página, o cartão é o do papel certo (nunca outro antes).
        const papeisVistos = [...new Set(lista.map((a) => a.cartao).filter(Boolean))];
        expect(papeisVistos, "um papel só, do primeiro ao último quadro").toEqual([c.papel]);
      });
    }
  }
});
