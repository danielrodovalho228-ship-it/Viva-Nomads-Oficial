import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T480 — MENUS-5 + MORADOR-NAV + E167 (prioridade do Daniel, 25/10): nenhum menu com mais de 5 destinos; as abas do
  topo (computador) e a barra de baixo (celular) saem da MESMA lista por papel; a Conta abre no avatar; a área do
  morador não mostra blocos nem menus do proprietário (E167).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t480.${sufixo}@lab.vivanomads.test`, nome: "Otávio Topo", role: "owner" as const };
const morador = { email: `morador.t480.${sufixo}@lab.vivanomads.test`, nome: "Marina Menus", role: "tenant" as const };
const semContrato = { email: `semcontrato.t480.${sufixo}@lab.vivanomads.test`, nome: "Sérgio Simples", role: "tenant" as const };
const ids: Record<string, string> = {};

const MORADOR_5 = ["Início", "Buscar", "Pedidos", "Mensagens", "Estadia"];
const DONO_5 = ["Início", "Anúncios", "Interessados", "Contratos", "Mensagens"];

const barraDeBaixo = (p: Page) => p.getByRole("navigation", { name: "Navegação principal" });

async function rotulosDaBarra(p: Page): Promise<string[]> {
  return (await barraDeBaixo(p).locator("a").allInnerTexts()).map((t) => t.trim());
}

test.describe("T480 — MENUS-5: abas por papel, Conta no avatar, morador sem nada do dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.semContrato = await criarConta(semContrato, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.morador, ids.semContrato]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio menus t480 ${sufixo}`, { ativo: true });
    const lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.morador, lead_id: lead, owner_plan: "pro", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.morador, ids.semContrato]);
  });

  test("morador com contrato, 1280 px: 5 abas no topo, sem barra lateral; subabas acendem a aba certa; Conta ▾ sem Ferramentas", async ({ browser }) => {
    const p = await entrar(browser, morador.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const abas = p.getByTestId("abas-morador");
    await expect(abas).toBeVisible({ timeout: 30_000 });
    await expect(abas.locator("a")).toHaveText(MORADOR_5, { timeout: 30_000 });
    await expect(p.getByTestId("barra-lateral")).toHaveCount(0);
    await expect(p.getByTestId("inicio-proprietario")).toHaveCount(0);
    await p.screenshot({ path: `${SAIDA}/t480-morador-inicio-1280.png` });

    await p.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("aba-morador-buscar")).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
    await expect(p.getByTestId("subabas-morador").locator("a")).toHaveText(["Buscar", "Favoritos", "Buscas salvas"]);
    await p.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("aba-morador-pedidos")).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
    await expect(p.getByTestId("subaba-morador-candidaturas")).toHaveAttribute("aria-current", "page");
    await p.screenshot({ path: `${SAIDA}/t480-morador-pedidos-1280.png` });

    await p.getByTestId("conta-morador").click();
    const menu = p.getByTestId("menu-conta-morador");
    await expect(menu).toBeVisible();
    // E176 (D2): atalho curto — Minha conta · Modo · Ajuda · Sair.
    await expect(menu).toContainText("Minha conta");
    await expect(menu).not.toContainText("Ferramentas");
    await expect(menu.getByRole("menuitem").last()).toHaveText("Sair");
    await p.screenshot({ path: `${SAIDA}/t480-morador-conta-1280.png` });

    // E167: Contratos no modo morador falam como quem mora (nada de "registrar recebimento").
    await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("contratos-modo-morador")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("registrar-recebimento")).toHaveCount(0);
    await expect(p.getByTestId("aba-morador-estadia")).toHaveAttribute("aria-current", "page");
    await p.context().close();
  });

  for (const w of [390, 360] as const) {
    test(`morador com contrato, ${w} px: a mesma lista na barra de baixo (sem "Perfil"); Conta no avatar de 44 px`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: w, height: 844 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect.poll(() => rotulosDaBarra(p), { timeout: 30_000 }).toEqual(MORADOR_5);
      // "Estadia" cabe sem cortar (o "Minha estadia" cortava a 390/360 px — MENUS-5, item 4).
      const cortado = await barraDeBaixo(p)
        .locator("a", { hasText: "Estadia" })
        .locator("span.truncate")
        .evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(cortado, `"Estadia" cortado a ${w} px`).toBe(false);
      const avatar = p.getByTestId("topo-celular").getByTestId("conta-morador-celular");
      const caixa = (await avatar.boundingBox())!;
      expect(caixa.width).toBeGreaterThanOrEqual(44);
      expect(caixa.height).toBeGreaterThanOrEqual(44);
      await expect(p.getByRole("button", { name: "Abrir menu" })).toHaveCount(0);
      await p.screenshot({ path: `${SAIDA}/t480-morador-inicio-${w}.png` });
      await avatar.click();
      const menu = p.getByTestId("menu-conta-morador-celular");
      await expect(menu).toBeVisible();
      await expect(menu).toContainText("Minha conta");
      await expect(menu).toContainText("Ajuda");
      await p.screenshot({ path: `${SAIDA}/t480-morador-conta-${w}.png` });
      await p.context().close();
    });
  }

  test("morador sem contrato: as mesmas 5 abas — a Estadia aparece sempre (E176 D1)", async ({ browser }) => {
    const p = await entrar(browser, semContrato.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("abas-morador").locator("a")).toHaveText(MORADOR_5, { timeout: 30_000 });
    await p.screenshot({ path: `${SAIDA}/t480-sem-contrato-1280.png` });
    await p.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => rotulosDaBarra(p), { timeout: 30_000 }).toEqual(MORADOR_5);
    await p.screenshot({ path: `${SAIDA}/t480-sem-contrato-390.png` });
    await p.context().close();
  });

  test("dono: as mesmas 5 abas no topo e no celular; Ferramentas no Início; modo morador sem nada do dono (E167)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("abas-dono").locator("a")).toHaveText(DONO_5, { timeout: 30_000 });
    await expect(p.getByTestId("inicio-dono-todas-ferramentas")).toBeVisible();
    await p.getByTestId("conta-dono").click();
    await expect(p.getByTestId("menu-conta-dono")).not.toContainText("Ferramentas");
    await p.screenshot({ path: `${SAIDA}/t480-dono-1280.png` });
    await p.keyboard.press("Escape");
    await p.goto("/dashboard/garantias", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("aba-dono-contratos")).toHaveAttribute("aria-current", "page", { timeout: 30_000 });

    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect.poll(() => rotulosDaBarra(p), { timeout: 30_000 }).toEqual(DONO_5);
    await p.screenshot({ path: `${SAIDA}/t480-dono-390.png` });

    // Modo morador pela Conta (avatar): o Início é só do morador.
    await p.getByTestId("topo-celular").getByTestId("conta-dono-celular").click();
    await p.getByTestId("conta-dono-celular-modo-morador").click();
    await expect(p.getByTestId("inicio-so-morador")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("inicio-proprietario")).toHaveCount(0);
    await expect(p.getByText("Como proprietário")).toHaveCount(0);
    await expect.poll(() => rotulosDaBarra(p), { timeout: 30_000 }).not.toContain("Anúncios");
    await p.screenshot({ path: `${SAIDA}/t480-dono-em-modo-morador-390.png` });
    await p.setViewportSize({ width: 1280, height: 900 });
    await expect(p.getByTestId("abas-morador")).toBeVisible();
    await p.screenshot({ path: `${SAIDA}/t480-dono-em-modo-morador-1280.png` });
    // Volta ao modo dono (para não deixar a conta de teste no modo morador).
    await p.getByTestId("conta-morador").click();
    await p.getByTestId("conta-morador-modo-proprietario").click();
    await expect(p.getByTestId("abas-dono")).toBeVisible({ timeout: 30_000 });
    await p.context().close();
  });
});
