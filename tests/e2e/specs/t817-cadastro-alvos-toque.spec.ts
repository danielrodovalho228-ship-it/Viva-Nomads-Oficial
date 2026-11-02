import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T817 — varredura 02/11 (Pista A): no cadastro do anúncio, num aparelho de toque (390 e 768 px), os controles pequenos
  têm alvo de 44 px — interruptores dos blocos opcionais (Regras), "−"/"+" dos contadores (Detalhes), "Ver fotógrafos
  na cidade do imóvel" (Fotos), "Adicionar faixa de desconto" (Preço) e "Faltam N itens…" (Revisão). Sem rolagem lateral.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t817.${sufixo}@lab.vivanomads.test`, nome: "Tina Toque", role: "owner" as const };
const ids: Record<string, string> = {};
const alvo = (p: Page, sel: string) =>
  p.locator(sel).first().evaluate((e) => Math.max(e.getBoundingClientRect().height, parseFloat(getComputedStyle(e, "::after").height) || 0));

test.describe("T817 — cadastro: alvos de toque de 44 px", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 768] as const) {
    test(`a ${w} px (toque): os controles pequenos do cadastro com 44 px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 1024 }, hasTouch: true, isMobile: true });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      const passos: [string, string][] = [
        ["detalhes", '[data-testid="contador"] button'],
        ["regras", '[data-testid$="-toggle"][role="switch"]'],
        ["fotos", '[data-testid="porta-fotografo-link"]'],
        ["preco", '[data-testid="adicionar-faixa"]'],
        ["revisao", '[data-testid="publicar-motivo"]'],
      ];
      for (const [etapa, sel] of passos) {
        await p.goto(`/dashboard/imoveis/novo?etapa=${etapa}`, { waitUntil: "domcontentloaded" });
        await noPasso(p, etapa as Parameters<typeof noPasso>[1], 30_000);
        const n = await p.locator(sel).count();
        test.skip(n === 0 && etapa !== "preco" && etapa !== "revisao", `Sem ${sel} na etapa ${etapa}.`);
        if (n === 0) continue; // "Adicionar faixa" some no limite de faixas; o motivo só aparece se falta algo
        expect(await alvo(p, sel), `${etapa}: ${sel}`).toBeGreaterThanOrEqual(44);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
        await p.screenshot({ path: `${SAIDA}/t817-${etapa}-${w}.png` });
      }
      await ctx.close();
    });
  }
});
