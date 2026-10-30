import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T677 — E193 (reteste de 30/10, ordem do Daniel de 25/10): o Passo 6 inteiro no padrão único de cartões grandes
  tocáveis da Qualificação. Com os blocos opcionais abertos, inventaria os controles de escolha à vista:
   - nenhuma pílula (botão arredondado de chip) e nenhuma caixa quadrada;
   - interruptor só o do bloco opcional (padrão E56: data-testid "bloco-…-toggle");
   - "O que considerar antes de pedir" em cartões de marcar; o acesso segue em cartão de escolha única.
  1280 e 390, com prints.
*/
const SAIDA = "tests/laboratorio/saida";

const inventario = (p: Page) =>
  p.evaluate(() => {
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.opacity !== "0";
    };
    const raiz = document.querySelector("main") ?? document.body;
    const fora = (el: Element) => !!el.closest("[data-testid=assistente-rodape], header, nav, [role=dialog]");
    const rot = (el: Element) => (el.getAttribute("data-testid") || (el.textContent ?? "").trim().slice(0, 40) || el.getAttribute("aria-label") || "").replace(/\s+/g, " ");
    const r: Record<string, string[]> = { caixa: [], chave: [], pilula: [], cartao: [] };
    for (const el of Array.from(raiz.querySelectorAll("input[type=checkbox], input[type=radio]"))) if (!fora(el) && visivel(el)) r.caixa.push(rot(el.closest("label") ?? el));
    for (const el of Array.from(raiz.querySelectorAll("[role=switch]"))) {
      if (fora(el) || !visivel(el)) continue;
      const id = el.getAttribute("data-testid") ?? "";
      if (/^bloco-.*-toggle$/.test(id)) continue; // padrão E56 (bloco opcional atrás de interruptor): exceção aprovada
      // Cartão de "mostrar no anúncio" usa role=switch, mas é o cartão grande: conta como cartão.
      if (el.hasAttribute("data-cartao-assistente")) { r.cartao.push(rot(el)); continue; }
      r.chave.push(rot(el));
    }
    for (const el of Array.from(raiz.querySelectorAll("button[aria-pressed], button[role=radio], button[role=checkbox]"))) {
      if (fora(el) || !visivel(el)) continue;
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      r[parseFloat(cs.borderTopLeftRadius) >= b.height / 2 - 1 ? "pilula" : "cartao"].push(rot(el));
    }
    return r;
  });

test.describe("T677 — E193: Passo 6 em cartões", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t677.${sufixo}@lab.vivanomads.test`, nome: "Rui Regras", role: "owner" as const };
  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t677 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — Passo 6 só com cartões (e o interruptor do bloco opcional)`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=regras`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("assistente-rodape")).toBeVisible({ timeout: 30_000 });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      // Abre os blocos opcionais (ruído, extras, acessibilidade…) para ver o que há dentro.
      for (const t of await p.locator('[data-testid^="bloco-"][data-testid$="-toggle"][aria-checked="false"]').all()) await t.click().catch(() => {});
      await p.waitForTimeout(500);
      const inv = await inventario(p);
      console.log(`t677 ${largura}`, JSON.stringify(inv));
      expect(inv.pilula, `pílulas: ${inv.pilula.join(" | ")}`).toEqual([]);
      expect(inv.caixa, `caixas: ${inv.caixa.join(" | ")}`).toEqual([]);
      expect(inv.chave, `interruptores fora do bloco opcional: ${inv.chave.join(" | ")}`).toEqual([]);
      expect(inv.cartao.length).toBeGreaterThan(8);
      await expect(p.locator('[data-testid^="considerar-"][role=checkbox]').first()).toBeVisible();
      await expect(p.locator('[data-testid^="tipo-entrada-"][role=radio]').first()).toBeVisible();
      await p.screenshot({ path: `${SAIDA}/t677-passo6-${largura}.png`, fullPage: true });
      await p.context().close();
    });
  }
});
