import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T689 — E193 (#1567 Passo 5, #1568 Passo 6): spec permanente da Pista C. A t680 e a t677 (Pista A) inventariam os
  controles (nenhuma pílula, nenhuma caixa, interruptor só no bloco opcional); esta cobre o que o inventário não vê:
   1. TOCÁVEL: todo cartão de escolha à vista nos Passos 5 e 6 (blocos opcionais abertos) tem ao menos 48 px de altura
      e 44 px de largura, e nenhum sai da tela (390 e 1280);
   2. MARCAR: o cartão de marcar inverte o aria-checked a cada toque (Ruído no Passo 5, "O que considerar" no Passo 6);
   3. ESCOLHA ÚNICA (exceção aprovada): no "tipo de entrada" do Passo 6, tocar outro cartão deixa só ele marcado;
   4. TOGGLE (exceção aprovada, padrão E56): com o bloco do Ruído desligado, os cartões dele não aparecem; ligado, sim;
   5. GRAVA: o Ruído marcado no cartão e salvo volta marcado depois de recarregar (e no banco, imovel_ruido).
  Conta de teste e rascunho semeados aqui e apagados no fim. Só no laboratório.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t689.${sufixo}@lab.vivanomads.test`, nome: "Lia Cartoes", role: "owner" as const };
const ids: Record<string, string> = {};

const passo = (etapa: string) => `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${etapa}`;

async function abrir(p: Page, etapa: string) {
  await p.goto(passo(etapa), { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("assistente-rodape")).toBeVisible({ timeout: 30_000 });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** Liga os blocos opcionais um de cada vez (abrir um pode remontar os outros), como a t680. */
async function abrirBlocos(p: Page) {
  const desligados = p.locator('[data-testid^="bloco-"][data-testid$="-toggle"][aria-checked="false"]');
  for (let i = 0; i < 10 && (await desligados.count()) > 0; i++) {
    const id = (await desligados.first().getAttribute("data-testid"))!;
    await p.getByTestId(id).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await p.getByTestId(id).click({ timeout: 10_000 });
    await expect(p.getByTestId(id)).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });
  }
  await p.waitForTimeout(400);
}

/** Cartões do assistente à vista que não cabem no toque (altura < 48, largura < 44) ou saem da tela. */
const cartoesRuins = (p: Page) =>
  p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const ruins: string[] = [];
    let total = 0;
    for (const el of Array.from(document.querySelectorAll("main [data-cartao-assistente]"))) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width <= 2 || r.height <= 2 || cs.visibility === "hidden") continue;
      total++;
      const nome = el.getAttribute("data-testid") || (el.textContent ?? "").trim().slice(0, 30);
      if (r.height < 48 || r.width < 44) ruins.push(`${nome}: ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (r.left < -1 || r.right > vw + 1) ruins.push(`${nome}: fora da tela (${Math.round(r.left)}–${Math.round(r.right)} de ${vw})`);
    }
    return { total, ruins };
  });

test.describe("T689 — E193: cartões grandes tocáveis nos Passos 5 e 6 (marcar, escolha única, toggle, grava)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t689 ${sufixo}`);
  });
  test.afterAll(async () => {
    if (ids.rascunho) await adm().from("imovel_ruido").delete().eq("property_id", ids.rascunho);
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`1. ${largura} px — todo cartão dos Passos 5 e 6 tem tamanho de toque e cabe na tela`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      for (const etapa of ["comodidades", "regras"]) {
        await abrir(p, etapa);
        await abrirBlocos(p);
        const { total, ruins } = await cartoesRuins(p);
        console.log(`t689 ${largura} ${etapa}: ${total} cartões`);
        expect(total, `${etapa}: cartões à vista`).toBeGreaterThan(5);
        expect(ruins, `${etapa} @${largura}: cartões pequenos ou fora da tela`).toEqual([]);
        await p.screenshot({ path: `${SAIDA}/t689-${etapa}-${largura}.png`, fullPage: true });
      }
      await p.context().close();
    });
  }

  test("2–3. marcar inverte a cada toque; na escolha única, só o último tocado fica marcado (390)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await abrir(p, "regras");
    const considerar = p.locator('[data-testid^="considerar-"][role=checkbox]').first();
    await considerar.scrollIntoViewIfNeeded();
    const antes = await considerar.getAttribute("aria-checked");
    await considerar.click();
    await expect(considerar).toHaveAttribute("aria-checked", antes === "true" ? "false" : "true");
    await considerar.click();
    await expect(considerar).toHaveAttribute("aria-checked", antes ?? "false");

    const entradas = p.locator('[data-testid^="tipo-entrada-"][role=radio]');
    expect(await entradas.count(), "opções do tipo de entrada").toBeGreaterThan(1);
    for (const i of [0, 1]) {
      await entradas.nth(i).scrollIntoViewIfNeeded();
      await entradas.nth(i).click();
      await expect(entradas.nth(i)).toHaveAttribute("aria-checked", "true");
      await expect(p.locator('[data-testid^="tipo-entrada-"][role=radio][aria-checked="true"]')).toHaveCount(1);
    }
    await p.context().close();
  });

  test("4–5. Ruído atrás do toggle: desligado sem cartões, ligado com eles; o marcado e salvo volta depois de recarregar (1280)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await abrir(p, "comodidades");
    const toggle = p.getByTestId("bloco-nivel-ruido-toggle");
    await toggle.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(toggle).toHaveAttribute("aria-checked", "false", { timeout: 20_000 });
    await expect(p.getByTestId("ruido-via_intensa")).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    const via = p.getByTestId("ruido-via_intensa");
    await expect(via).toBeVisible();
    await expect(via).toHaveAttribute("aria-checked", "false");
    await via.click();
    await expect(via).toHaveAttribute("aria-checked", "true");
    await p.getByTestId("ruido-salvar").click();
    await expect(p.getByTestId("ruido-resultado")).toHaveAttribute("role", "status", { timeout: 20_000 });
    await expect
      .poll(async () => (await adm().from("imovel_ruido").select("via_intensa").eq("property_id", ids.rascunho).maybeSingle()).data?.via_intensa ?? null, { timeout: 20_000 })
      .toBe(true);

    await abrir(p, "comodidades");
    // Com dados salvos o bloco já nasce ligado (nasceLigado) e o cartão volta marcado.
    await expect(p.getByTestId("bloco-nivel-ruido-toggle")).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
    await expect(p.getByTestId("ruido-via_intensa")).toHaveAttribute("aria-checked", "true");
    await expect(p.getByTestId("ruido-noturno_obra_100m")).toHaveAttribute("aria-checked", "false");
    await p.getByTestId("ruido-form").screenshot({ path: `${SAIDA}/t689-ruido-gravado-1280.png` });
    await p.context().close();
  });
});
