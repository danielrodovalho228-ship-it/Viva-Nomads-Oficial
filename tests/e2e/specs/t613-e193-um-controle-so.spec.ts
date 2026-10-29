import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T613 — E193 (auditoria de 28/10): um só estilo de controle no assistente de cadastro. Em cada etapa, inventaria os
  controles de escolha à vista e classifica: "pilula" (botão/rótulo arredondado de chip), "cartao" (botão-cartão de
  escolha), "caixa" (checkbox quadrado à vista), "lista" (select nativo), "chave" (switch). Dentro do assistente não
  pode haver "caixa" nem "lista" (exceção anotada: o Estado/UF da busca de CEP, que nem aparece sem abrir a busca).
  A 1280 e 390 px.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t613.${sufixo}@lab.vivanomads.test`, nome: "Cora Controle", role: "owner" as const };
const ids: Record<string, string> = {};
const ETAPAS = ["tipo", "fotos", "endereco", "detalhes", "comodidades", "regras", "descricao", "preco", "disponibilidade", "revisao"] as const;

/** Inventário dos controles de escolha visíveis dentro do conteúdo do assistente (fora do rodapé). */
const inventario = (p: Page) =>
  p.evaluate(() => {
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.opacity !== "0";
    };
    const raiz = document.querySelector("main") ?? document.body;
    const fora = (el: Element) => !!el.closest("[data-testid=assistente-rodape], header, nav, [role=dialog]");
    const achados: Record<string, string[]> = { caixa: [], lista: [], chave: [], pilula: [], cartao: [] };
    const rot = (el: Element) => (el.getAttribute("data-testid") || (el.textContent ?? "").trim().slice(0, 40) || el.getAttribute("aria-label") || "").replace(/\s+/g, " ");
    for (const el of Array.from(raiz.querySelectorAll("input[type=checkbox], input[type=radio]"))) {
      if (fora(el) || !visivel(el)) continue;
      achados.caixa.push(`${(el as HTMLInputElement).type}:${rot(el.closest("label") ?? el)}`);
    }
    for (const el of Array.from(raiz.querySelectorAll("select"))) if (!fora(el) && visivel(el)) achados.lista.push(rot(el.closest("label") ?? el));
    for (const el of Array.from(raiz.querySelectorAll("[role=switch]"))) if (!fora(el) && visivel(el)) achados.chave.push(rot(el.closest("label") ?? el));
    for (const el of Array.from(raiz.querySelectorAll("button[aria-pressed], button[role=radio], button[role=checkbox], [role=radio], [role=checkbox], label:has(> input.sr-only)"))) {
      if (fora(el) || !visivel(el)) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const pilula = parseFloat(cs.borderTopLeftRadius) >= r.height / 2 - 1;
      achados[pilula ? "pilula" : "cartao"].push(rot(el));
    }
    return Object.fromEntries(Object.entries(achados).map(([k, v]) => [k, [...new Set(v)]]));
  });

test.describe("T613 — E193: um só estilo de controle no cadastro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  // Sem "serial": a 390 roda mesmo se a 1280 falhar (a rodada "antes" mostra as duas larguras).
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t613 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — nenhuma caixa quadrada nem lista suspensa nas 10 etapas`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const falhas: string[] = [];
      for (const etapa of ETAPAS) {
        await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${etapa}`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("assistente-rodape")).toBeVisible({ timeout: 30_000 });
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        const inv = await inventario(p);
        console.log(`t613 ${largura} ${etapa}`, JSON.stringify(inv));
        if (inv.caixa.length) falhas.push(`${etapa}: caixas ${inv.caixa.join(" | ")}`);
        if (inv.lista.length) falhas.push(`${etapa}: listas ${inv.lista.join(" | ")}`);
        if (["comodidades", "regras", "preco", "disponibilidade", "revisao"].includes(etapa)) await p.screenshot({ path: `${SAIDA}/t613-${etapa}-${largura}.png`, fullPage: true });
      }
      expect(falhas, falhas.join("\n")).toEqual([]);
      await p.context().close();
    });
  }
});
