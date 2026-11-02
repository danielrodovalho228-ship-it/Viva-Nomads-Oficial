import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TITULO_PASSO, noPasso } from "../fixtures/cadastro";

/*
  T823 — estabilidade do cadastro (02/11, Pista A): "Continuar de onde parou" / "Resolver" abrem o rascunho direto num
  passo (?draft=…&etapa=…). Antes a tela nascia no Passo 1 e trocava depois de ler o rascunho (salto de layout de até
  0,78 no celular; o Passo 1 aparecia por um instante). Agora: o Passo 1 nunca aparece e o salto fica < 0,1. 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t823.${sufixo}@lab.vivanomads.test`, nome: "Sara Salto", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T823 — cadastro abre no passo da URL, sem salto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho salto t823 ${sufixo}`, { semInternet: true, semConforto: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: ?draft=&etapa=preco abre no Preço desde o 1º desenho`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      await ctx.addInitScript(() => {
        const g = window as unknown as { __cls: number; __titulos: string[] };
        g.__cls = 0;
        g.__titulos = [];
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) g.__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
        // Registra todo título de passo que chegar a aparecer (o Passo 1 não pode piscar antes do Preço).
        new MutationObserver(() => {
          const t = document.querySelector('[data-testid="passo-titulo"]')?.textContent?.trim();
          if (t && g.__titulos[g.__titulos.length - 1] !== t) g.__titulos.push(t);
        }).observe(document, { childList: true, subtree: true, characterData: true });
      });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=preco`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "preco", 30_000);
      await p.waitForTimeout(2500);
      const r = await p.evaluate(() => {
        const g = window as unknown as { __cls: number; __titulos: string[] };
        return { cls: g.__cls, titulos: g.__titulos };
      });
      expect(r.titulos, "o Passo 1 não aparece antes do Preço").not.toContain(TITULO_PASSO.tipo);
      expect(r.cls).toBeLessThan(0.1);
      await ctx.close();
    });
  }
});
