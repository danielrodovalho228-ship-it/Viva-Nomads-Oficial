import { test, expect, type Page, type Locator, type Browser } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  cpfAleatorio,
  criarConta,
  criarImovelPronto,
  liberarLimiteLogin,
  liberarLimiteLoginIp,
  novaSenha,
  novoSufixo,
  tornarContratoVigente,
} from "../fixtures/laboratorio";

/*
  T263 — Regressão visual do Prompt 41 (mesmo padrão do t245: snapshotPathTemplate estável do playwright.config,
  linha de base em tests/e2e/visual/t263-visual-41.spec.ts/, só muda no PR que muda a tela), a 390 e 1280 px:
    01 página do imóvel INTEIRA (de cima a baixo), ube-001;
    02–04 barra inferior dos 3 papéis (morador, proprietário, parceiro) — 390 no site e 1280 no app (a barra do site
          some no computador; no app ela existe em qualquer largura);
    06–08 cogumelo aberto na página da estadia (folha "Ações desta estadia", adendo do 41): 06 morador antes da
          liberação das instruções de chegada, 07 morador depois, 08 proprietário. (A antiga 05, o cogumelo no detalhe
          do contrato, saiu: o cogumelo agora mora só na página da estadia.)
  Gerar / atualizar a linha de base (no laboratório, base recém-semeada):
    npx playwright test t263 --update-snapshots
  Estabilidade: fotos, mapa, datas, contagens, nomes e o calendário vão MASCARADOS; a duração da busca é fixada
  (localStorage vazio = estadia mínima do imóvel); os "imóveis parecidos" (que mudam com a base) mascaram o texto dos
  cartões e mantêm a forma (como a tela 09 do t245). As telas 04 e 06–08 criam contas próprias: só no laboratório.
  Rodada L-33/L-4 (Pista C, 23/10 à noite): roda no lab-crítico do PR da vigia só para publicar o diff (esperado, obtido, diferença) para o QA do Muse; a linha de base só muda com o OK registrado.
*/
const LARGURAS = [390, 1280] as const;
const altura = (l: number) => (l === 390 ? 844 : 900);
/** Dia (AAAA-MM-DD) daqui a `n` dias no calendário de Brasília (o mesmo cálculo do t256). */
const diaBrasilia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const UA_APP = "Mozilla/5.0 (Linux; Android 14; Pixel 7) VivaNomadsApp/1.0 (expo)";

function mascaras(page: Page): Locator[] {
  return [
    page.locator("img, video, canvas, svg image"),
    page.locator('.leaflet-container, .mapboxgl-map, [data-testid="mapa-tela-cheia"]'),
    page.locator("time"),
    page.locator('[data-testid="cartao-disponivel"], [data-testid="cartao-nota"], [data-testid="marca-imovel"], [data-testid="aviso-testes"]'),
    page.locator('[data-testid="sinais-confianca"], [data-testid="barra-status"], #disponibilidade'),
    page.locator('[data-testid="imoveis-parecidos"] [data-testid="cartao-local"], [data-testid="imoveis-parecidos"] [data-testid="cartao-titulo"], [data-testid="imoveis-parecidos"] [data-testid="cartao-total-mes"], [data-testid="imoveis-parecidos"] [data-testid="cartao-sintese"]'),
    // Contadores das abas (mensagens não lidas) e o nome/foto do cabeçalho.
    page.locator('nav [aria-label$="não lidas"], nav [aria-label$="novos"], [data-testid="papel-ativo"] span:first-child'),
    page.locator('[data-visual="muda"]'),
  ];
}

async function pronta(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Desce a página aos poucos para os blocos tardios (avaliações, parecidos) carregarem antes da captura inteira.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
}

async function entrarComo(browser: Browser, email: string, senha: string, largura: number, app: boolean): Promise<Page> {
  await liberarLimiteLogin(email);
  await liberarLimiteLoginIp();
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura(largura) }, ...(app ? { userAgent: UA_APP } : {}) });
  const page = await ctx.newPage();
  // Conta recém-criada às vezes não sai do /auth na 1ª tentativa no laboratório (sessão ainda propagando): tenta 2 vezes.
  for (let tentativa = 1; ; tentativa++) {
    await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"], input[type="email"]').first().fill(email);
    await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 25_000 });
      break;
    } catch (e) {
      if (tentativa >= 2) throw e;
      await liberarLimiteLogin(email);
    }
  }
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return page;
}

test.describe("T263 — Regressão visual do Prompt 41", () => {
  test.describe.configure({ timeout: 120_000 });

  // ── 01 página do imóvel inteira ──
  for (const largura of LARGURAS) {
    test.describe(`página do imóvel ${largura} px`, () => {
      test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: altura(largura) } });
      test("01 página do imóvel inteira (ube-001)", async ({ page }) => {
        await page.addInitScript(() => localStorage.removeItem("vn:ultima-busca"));
        await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
        await pronta(page);
        await expect(page).toHaveScreenshot(`01-imovel-inteiro-${largura}.png`, { fullPage: true, mask: mascaras(page), maxDiffPixelRatio: 0.02 });
      });
    });
  }

  // ── 02–03 barra do morador e do proprietário (contas fixas do laboratório) ──
  for (const [n, papel, rota] of [
    ["02", "inquilino", "/dashboard/favoritos"],
    ["03", "proprietario", "/dashboard/imoveis"],
  ] as const) {
    for (const largura of LARGURAS) {
      test.describe(`barra ${papel} ${largura} px`, () => {
        test.skip(!hasAccount(papel), `Sem a conta de teste ${papel}.`);
        test.use({
          storageState: authFile(papel),
          viewport: { width: largura, height: altura(largura) },
          // No computador a barra só existe dentro do app.
          ...(largura === 1280 ? { userAgent: UA_APP } : {}),
        });
        test(`${n} barra inferior (${papel})`, async ({ page }) => {
          // Rota exclusiva do papel: a casca acerta o modo da conta antes do print.
          await page.goto(rota, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined); // o painel mantém conexão aberta
          const barra = page.locator(largura === 1280 ? 'nav[aria-label="Abas do app"]' : 'nav[aria-label="Navegação principal"]');
          await expect(barra).toBeVisible();
          await expect(barra.getByRole("link")).toHaveCount(5);
          await pronta(page);
          const nome = papel === "inquilino" ? "morador" : "proprietario";
          await expect(barra).toHaveScreenshot(`${n}-barra-${nome}-${largura}${largura === 1280 ? "-app" : ""}.png`, { mask: mascaras(page) });
        });
      });
    }
  }

  // ── 04 barra do parceiro aprovado e 06–08 cogumelo da estadia (contas próprias: só no laboratório) ──
  test.describe("laboratório", () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório (cria parceiro aprovado e uma estadia de teste).");
    test.describe.configure({ mode: "serial" });
    const senha = novaSenha();
    const sufixo = novoSufixo();
    // Nomes fixos (o sufixo só vai no e-mail e no slug): o print não oscila entre rodadas.
    const parceiro = { email: `parceiro.t260.${sufixo}@lab.vivanomads.test`, nome: "Paula Visual", role: "tenant" as const };
    const dono = { email: `dono.t260.${sufixo}@lab.vivanomads.test`, nome: "Dalva Visual", role: "owner" as const };
    const inq = { email: `inq.t260.${sufixo}@lab.vivanomads.test`, nome: "Igor Visual", role: "tenant" as const };
    const ids: { parceiro?: string; dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

    test.beforeAll(async () => {
      ids.parceiro = await criarConta(parceiro, senha);
      const { error } = await adm()
        .from("parceiros")
        .insert({ user_id: ids.parceiro, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: "Paula Visual", slug: `paula-t260-${sufixo}`.toLowerCase().replace(/[^a-z0-9-]/g, "") });
      if (error) throw error;
      ids.dono = await criarConta(dono, senha);
      ids.inq = await criarConta(inq, senha);
      ids.imovel = await criarImovelPronto(ids.dono, "Estadia visual t260", { ativo: true });
      const { data, error: e2 } = await adm()
        .from("contratos")
        .insert({
          property_id: ids.imovel,
          tenant_id: ids.inq,
          owner_plan: "essential",
          faixa: "temporada",
          prazo_total_dias: 60,
          aluguel_mensal: 3200,
          tamanho_bloco_meses: 2,
          comissao_percent: 0.08,
          comissao_valor: 256,
          qtd_ocupantes: 1,
          status: "ativo",
          garantia: "caucao",
        })
        .select("id")
        .single();
      if (e2) throw e2;
      ids.contrato = data.id as string;
      await tornarContratoVigente(ids.contrato, ids.dono);
    });
    test.afterAll(async () => {
      if (ids.parceiro) await adm().from("parceiros").delete().eq("user_id", ids.parceiro);
      if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
      await apagarContas([ids.parceiro, ids.dono, ids.inq]);
    });

    for (const largura of LARGURAS) {
      test(`04 barra inferior (parceiro) ${largura} px`, async ({ browser }) => {
        const page = await entrarComo(browser, parceiro.email, senha, largura, largura === 1280);
        await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined); // o painel mantém conexão aberta
        const barra = page.locator(largura === 1280 ? 'nav[aria-label="Abas do app"]' : 'nav[aria-label="Navegação principal"]');
        await expect(barra.getByRole("link", { name: "Pedidos" })).toBeVisible({ timeout: 20_000 });
        await pronta(page);
        await expect(barra).toHaveScreenshot(`04-barra-parceiro-${largura}${largura === 1280 ? "-app" : ""}.png`, { mask: mascaras(page) });
        await page.context().close();
      });
    }

    // Antes (entrada em 20 dias) e depois (entrada em 5 dias) da liberação das instruções (D-7, como no t256).
    for (const [n, quem, fase, entrada] of [
      ["06", "morador", "antes", 20],
      ["07", "morador", "depois", 5],
      ["08", "proprietario", "", 5],
    ] as const) {
      for (const largura of LARGURAS) {
        test(`${n} cogumelo da estadia (${quem}${fase ? ` ${fase}` : ""}) ${largura} px`, async ({ browser }) => {
          const { error } = await adm()
            .from("contrato_blocos")
            .update({ inicio: diaBrasilia(entrada), fim: diaBrasilia(entrada + 59) })
            .eq("contrato_id", ids.contrato!)
            .eq("numero_bloco", 1);
          if (error) throw error;
          const page = await entrarComo(browser, quem === "morador" ? inq.email : dono.email, senha, largura, false);
          await page.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
          await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined); // o painel mantém conexão aberta
          await expect(page.getByTestId("pagina-estadia")).toBeVisible({ timeout: 20_000 });
          await page.getByTestId("cogumelo").click();
          const folha = page.getByRole("dialog", { name: "Ações desta estadia" });
          await expect(folha).toBeVisible();
          await expect(folha.getByTestId("acoes-estadia-lista").locator("li")).toHaveCount(quem === "proprietario" ? 7 : fase === "antes" ? 5 : 6);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(400); // animação da folha
          const nome = `${n}-estadia-cogumelo-${quem}${fase ? `-${fase}` : ""}-${largura}.png`;
          await expect(folha).toHaveScreenshot(nome, { mask: mascaras(page) });
          await page.context().close();
        });
      }
    }
  });
});
