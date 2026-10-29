import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T644 — conformidade da Conta com os mockups perfil-01..08 (29/10): no computador o menu lateral "Conta" começa na
  linha do título da tela e fica na MESMA altura em todas as seções (antes, nas telas longas, o sticky top-24 o
  empurrava 96 px para baixo; só Avaliações, curta, ficava no lugar). Ao rolar, o menu continua à vista.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t644.${sufixo}@lab.vivanomads.test`, nome: "Carla Menu", role: "owner" as const };
const ids: string[] = [];
const SECOES = ["avaliacoes", "dados", "privacidade", "notificacoes", "pagamentos", "ajuda", "seguranca", "papeis"] as const;

/** Topo do menu e do título, relativos ao topo da área que rola (o <main> do painel). */
const medir = (p: Page) =>
  p.evaluate(() => {
    const main = document.querySelector("[data-painel-main]") as HTMLElement;
    const topo = main.getBoundingClientRect().top;
    const menu = document.querySelector("[data-testid=conta-menu-lateral]")!.getBoundingClientRect();
    const h1 = Array.from(document.querySelectorAll("[data-testid=conta-cabecalho], [data-testid=conta-cabecalho-lateral]"))
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height > 0)[0];
    return { menu: Math.round(menu.top - topo), titulo: h1 ? Math.round(h1.top - topo) : null, alturaMenu: Math.round(menu.height) };
  });

test.describe("T644 — Conta: menu lateral na linha do título", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.push(await criarConta(dono, senha));
    await adm().from("profiles").update({ is_teste: true }).in("id", ids);
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  test("1280 px: mesma altura em todas as seções, alinhado ao título", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    const tops: Record<string, number> = {};
    for (const s of SECOES) {
      await p.goto(`/dashboard/conta/${s}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("conta-menu-lateral")).toBeVisible({ timeout: 30_000 });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const m = await medir(p);
      console.log(`t644|${s}|${JSON.stringify(m)}`);
      tops[s] = m.menu;
      // O menu começa na linha do título (em Privacidade, na da trilha "Conta › Privacidade", como no mockup perfil-05).
      expect(Math.abs(m.menu - (m.titulo ?? -999)), `${s}: menu ${m.menu} × título ${m.titulo}`).toBeLessThanOrEqual(4);
      if (s === "dados" || s === "avaliacoes") await p.screenshot({ path: `${SAIDA}/t644-conta-${s}-1280.png` });
    }
    const valores = Object.values(tops);
    expect(Math.max(...valores) - Math.min(...valores), `alturas do menu: ${JSON.stringify(tops)}`).toBeLessThanOrEqual(2);

    // Rolando a tela longa, o menu continua à vista (sticky), a 32 px do topo da área que rola.
    await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("conta-menu-lateral")).toBeVisible({ timeout: 30_000 });
    await p.locator("[data-painel-main]").evaluate((m) => m.scrollTo(0, 600));
    await p.waitForTimeout(300);
    const rolado = await medir(p);
    console.log(`t644|dados-rolado|${JSON.stringify(rolado)}`);
    expect(rolado.menu).toBe(32);
    await p.screenshot({ path: `${SAIDA}/t644-conta-dados-rolado-1280.png` });
    await p.context().close();
  });

  test("390 px: sem menu lateral (o celular usa ‹ Conta) — nada muda", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("conta-h1")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("conta-menu-lateral")).toBeHidden();
    await p.screenshot({ path: `${SAIDA}/t644-conta-dados-390.png` });
    await p.context().close();
  });
});
