import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TITULO_PASSO, noPasso, type PassoCadastro } from "../fixtures/cadastro";

/*
  T469 — E134: Passo 4 ("Detalhes do imóvel") alinhado, como o mockup cadastro-imovel-04. A 390 e a 1280:
   1. Um cartão de linhas: cada número (Quartos, Banheiros, Área, Pessoas, Vagas) com rótulo e dica à esquerda e o
      contador à direita — todos os contadores na MESMA coluna e com a mesma largura; nenhuma dica desloca a caixa;
      sem buraco de grade; sem rolagem lateral.
   2. "−" e "+" mudam o número e o campo continua digitável.
   3. Varredura "corrigir tudo": os 10 passos a 390 e 1280 sem rolagem lateral e sem botão vazando (prints para a régua).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t469.${sufixo}@lab.vivanomads.test`, nome: "Dora Detalhes", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T469 — E134: Passo 4 alinhado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1–2. a ${w} px: contadores na mesma coluna, linhas iguais, − e + funcionam`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo?etapa=detalhes", { waitUntil: "domcontentloaded" });
      const aviso = p.getByTestId("rascunho-aviso");
      await expect(p.getByTestId("passo-titulo").or(aviso).first()).toBeVisible({ timeout: 30_000 });
      await noPasso(p, "detalhes", 30_000);

      const cartao = p.getByTestId("cartao-numeros");
      await expect(cartao).toBeVisible();
      const contadores = cartao.getByTestId("contador");
      await expect(contadores).toHaveCount(5);
      const caixas = await contadores.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) })));
      // A mesma coluna (borda direita) e a mesma altura; a largura varia só pelo sufixo "m²" da Área.
      expect(new Set(caixas.map((c) => c.x)).size, "contadores alinhados à direita").toBe(1);
      expect(new Set(caixas.map((c) => c.h)).size, "contadores da mesma altura").toBe(1);
      expect(new Set(caixas.map((c) => c.w)).size, "contadores da mesma largura (o m² da Área não alarga o dele)").toBe(1);
      const linhas = await cartao.locator('[data-testid^="linha-"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(linhas).toHaveLength(5);
      expect(Math.max(...linhas) - Math.min(...linhas), "linhas da mesma altura").toBeLessThanOrEqual(2);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await cartao.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t469-passo4-${w}.png`, fullPage: true });

      // − e + mudam o número; o campo continua digitável.
      const quartos = p.getByTestId("cadastro-quartos");
      await quartos.fill("2");
      await p.getByRole("button", { name: "Aumentar Quartos" }).click();
      await expect(quartos).toHaveValue("3");
      await p.getByRole("button", { name: "Diminuir Quartos" }).click();
      await expect(quartos).toHaveValue("2");
      const pessoas = p.getByTestId("cadastro-capacidade");
      await pessoas.fill("1");
      await expect(p.getByRole("button", { name: "Diminuir Pessoas" })).toBeDisabled();
      await p.context().close();
    });
  }

  for (const w of [390, 1280] as const) {
    test(`3. a ${w} px: os 10 passos sem rolagem lateral (prints)`, async ({ browser }) => {
      test.setTimeout(240_000);
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      for (const passo of Object.keys(TITULO_PASSO) as PassoCadastro[]) {
        await p.goto(`/dashboard/imoveis/novo?etapa=${passo}`, { waitUntil: "domcontentloaded" });
        await noPasso(p, passo, 30_000);
        await p.waitForTimeout(500);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), passo).toBeLessThanOrEqual(1);
        // Régua: nenhum TEXTO de botão sai da caixa do botão nem da tela (imagem cortada de propósito, como nos cartões
        // de tipo do Passo 1, não conta).
        const vazados = await p.locator("main button:visible").evaluateAll((els) =>
          els
            .filter((b) => {
              // Carrossel com rolagem horizontal (os cartões de tipo do Passo 1): o que passa da tela é continuação.
              let pai = b.parentElement;
              let emCarrossel = false;
              while (pai && !emCarrossel) {
                const ox = getComputedStyle(pai).overflowX;
                emCarrossel = (ox === "auto" || ox === "scroll") && pai.scrollWidth > pai.clientWidth + 1;
                pai = pai.parentElement;
              }
              const caixa = b.getBoundingClientRect();
              const andar = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
              for (let n = andar.nextNode(); n; n = andar.nextNode()) {
                if (!n.textContent?.trim()) continue;
                const r = document.createRange();
                r.selectNodeContents(n);
                const t = r.getBoundingClientRect();
                if (t.width && (t.right > caixa.right + 1 || t.left < caixa.left - 1 || (!emCarrossel && t.right > window.innerWidth + 1))) return true;
              }
              return false;
            })
            .map((b) => (b.textContent ?? "").trim().slice(0, 60)),
        );
        expect(vazados, `${passo}: botões vazando`).toEqual([]);
        await p.screenshot({ path: `${SAIDA}/t469-varredura-${passo}-${w}.png`, fullPage: true });
      }
      await p.context().close();
    });
  }
});
