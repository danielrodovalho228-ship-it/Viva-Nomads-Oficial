import { test, expect, type Page, type Browser } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  cpfAleatorio,
  criarConta,
  criarImovelPronto,
  entrar,
  liberarLimiteLogin,
  liberarLimiteLoginIp,
  novaSenha,
  novoSufixo,
  tornarContratoVigente,
} from "../fixtures/laboratorio";

/*
  T258 — Prompt 41 (funcional, a 390 e 1280 px):
   1. página do imóvel: galeria em tela cheia no celular ("1/N", coração e compartilhar como ícones) e mosaico de 5
      com "Ver todas as fotos" no computador; a ordem título → síntese → anfitrião → comodidades → mapa → avaliações;
      sem "Onde você vai dormir" (as fotos ainda não têm o cômodo); rodapé fixo / cartão lateral com
      "R$ X/mês · R$ Y em N meses" (N = 1 → só "/mês"), "A Viva não segura dinheiro", UM primário "Solicitar"
      (abre a candidatura de sempre) e "Agendar visita" em texto terciário;
   2. barra inferior por papel: morador, proprietário e parceiro aprovado com 5 itens; admin sem barra; cabeçalho com
      a foto pequena e o papel ativo; troca de papel no Perfil (app);
   3. um primário por tela: varredura de [data-cta="primary"] visível, no máximo 1 por rota logada (lista abaixo);
   4. cogumelo: só no detalhe da estadia, para o morador e o proprietário dela; a folha "Ações desta estadia" só lista
      ações que existem; sombra única; não cobre o "Fale com a Viva".
  A regressão visual das mesmas telas fica no t259.
*/

const LARGURAS = [390, 1280] as const;
const SOMBRA_FLUTUANTE = "rgba(0, 0, 0, 0.12) 0px 6px 16px 0px";
const semRolagem = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Primários visíveis da tela (fora do cabeçalho público, das barras de navegação e de janelas abertas). */
async function primarios(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-cta="primary"]'))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // O cabeçalho do SITE (o que tem o logo) é navegação global, não ação da tela; o título da página (PageTitle) conta.
        const cabecalhoDoSite = el.closest("header")?.querySelector('a[aria-label="Viva Nomads"]');
        return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && !cabecalhoDoSite && !el.closest("nav, [role=dialog], [data-folha]");
      })
      .map((el) => (el.textContent ?? "").trim().slice(0, 40)),
  );
}

/** Botões com cara de primário (fundo verde-marca e texto branco) que não usam o <Button>: só anotação, para o inventário. */
async function primariosSemMarca(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("a, button"))
      .filter((el) => {
        if (el.matches('[data-cta="primary"]') || el.closest("header")?.querySelector('a[aria-label="Viva Nomads"]')) return false;
        if (el.closest("nav, aside, [role=dialog], [data-folha], [data-testid='fale-com-a-viva-raiz']")) return false;
        const b = el.getBoundingClientRect();
        if (b.width < 60 || b.height < 32) return false;
        const cs = getComputedStyle(el);
        return cs.backgroundColor === "rgb(28, 107, 58)" && cs.color === "rgb(255, 255, 255)";
      })
      .map((el) => (el.textContent ?? "").trim().slice(0, 40)),
  );
}

// ─────────────────────────── 1. Página do imóvel ───────────────────────────

for (const largura of LARGURAS) {
  test.describe(`T258 — página do imóvel a ${largura} px`, () => {
    test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    test("galeria: tela cheia + '1/N' + ícones (celular) · mosaico de 5 + 'Ver todas as fotos' (computador)", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      if (largura === 390) {
        const g = page.getByTestId("galeria-celular");
        await expect(g).toBeVisible();
        const caixa = (await g.boundingBox())!;
        expect(Math.round(caixa.x), "de borda a borda").toBe(0);
        expect(Math.round(caixa.width)).toBe(390);
        await expect(page.getByTestId("galeria-indicador")).toHaveText(/^1\/\d+$/);
        const acoes = page.getByTestId("galeria-acoes");
        await expect(acoes.getByTestId("coracao")).toBeVisible();
        await expect(acoes.getByRole("button", { name: "Compartilhar" })).toBeVisible();
        // Ícones, nunca botão com texto.
        expect((await acoes.innerText()).trim()).toBe("");
        await expect(page.getByTestId("galeria-mosaico")).toBeHidden();
      } else {
        const m = page.getByTestId("galeria-mosaico");
        await expect(m).toBeVisible();
        expect(await m.locator('[data-testid^="galeria-tile-"]').count()).toBeLessThanOrEqual(5);
        await expect(page.getByTestId("galeria-ver-todas")).toHaveText("Ver todas as fotos");
        await page.getByTestId("galeria-ver-todas").click();
        await expect(page.getByTestId("galeria-lightbox")).toBeVisible();
        await page.keyboard.press("Escape");
        const icones = page.getByTestId("titulo-icones");
        await expect(icones.getByTestId("coracao")).toBeVisible();
        await expect(icones.getByRole("button", { name: "Compartilhar" })).toBeVisible();
      }
      expect(await semRolagem(page)).toBeLessThanOrEqual(0);
    });

    test("ordem: título → síntese → anfitrião → comodidades → mapa → avaliações; sem 'Onde você vai dormir'", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      const ys: number[] = [];
      for (const l of [
        page.locator("h1").first(),
        page.getByTestId("imovel-sintese"),
        page.getByTestId("faixa-proprietario"),
        page.locator("#comodidades"),
        page.locator("#localizacao"),
        page.locator("#avaliacoes"),
      ]) {
        await expect(l).toBeAttached();
        ys.push((await l.boundingBox())!.y);
      }
      for (let i = 1; i < ys.length; i++) expect(ys[i], `item ${i} abaixo do anterior`).toBeGreaterThan(ys[i - 1]);
      // Síntese: pessoas · quartos · banheiros.
      await expect(page.getByTestId("imovel-sintese")).toHaveText(/quartos? · \d+ banheiros?/);
      await expect(page.getByTestId("ideal-para").first()).toBeVisible();
      await expect(page.getByText("Onde você vai dormir")).toHaveCount(0);
      await expect(page.getByText(/Tempo até/)).toHaveCount(0);
    });

    test("valor: 'R$ X/mês · R$ Y em N meses' pela duração da busca; N = 1 mostra só '/mês'; 'a Viva não segura dinheiro'", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("vn:ultima-busca", JSON.stringify({ inicio: "", meses: 3, pessoas: 0 })));
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      const num = (t: string) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
      if (largura === 390) {
        const barra = page.getByTestId("barra-fixa-imovel");
        await expect(barra).toBeVisible();
        const mes = num(await barra.getByTestId("barra-preco-mes").innerText());
        await expect(barra.getByTestId("barra-total-estadia")).toHaveText(/R\$\s?[\d.]+(,\d{2})? em 3 meses/);
        expect(num((await barra.getByTestId("barra-total-estadia").innerText()).replace(/em 3 meses/, ""))).toBeCloseTo(mes * 3, 0);
        await expect(barra.getByTestId("barra-nao-segura")).toContainText("A Viva não segura dinheiro");
        // O mesmo número do cartão de preço.
        expect(num(await page.getByTestId("total-por-mes").innerText())).toBe(mes);
      } else {
        const cartao = page.locator("#cartao-preco");
        const mes = num(await cartao.getByTestId("cartao-lateral-mes").innerText());
        await expect(cartao.getByTestId("cartao-lateral-estadia")).toHaveText(/R\$\s?[\d.]+(,\d{2})? em 3 meses/);
        expect(num((await cartao.getByTestId("cartao-lateral-estadia").innerText()).replace(/em 3 meses/, ""))).toBeCloseTo(mes * 3, 0);
        await expect(cartao.getByTestId("cartao-nao-segura")).toContainText("A Viva não segura dinheiro");
      }
      // N = 1: só "/mês".
      await page.evaluate(() => localStorage.setItem("vn:ultima-busca", JSON.stringify({ inicio: "", meses: 1, pessoas: 0 })));
      await page.reload({ waitUntil: "domcontentloaded" });
      const estadia = largura === 390 ? page.getByTestId("barra-total-estadia") : page.getByTestId("cartao-lateral-estadia");
      await expect(estadia).toHaveCount(0);
    });

    test("UM primário 'Solicitar' (a candidatura de sempre) e 'Agendar visita' em texto terciário, sem travar", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
      await expect(page.locator(largura === 390 ? '[data-testid="barra-solicitar"]' : '[data-testid="cartao-solicitar"]')).toBeVisible();
      await expect.poll(() => primarios(page), { timeout: 10_000 }).toEqual(["Solicitar"]);
      const escopo = largura === 390 ? page.getByTestId("barra-fixa-imovel") : page.locator("#cartao-preco");
      const visita = largura === 390 ? escopo.getByTestId("barra-agendar-visita") : escopo.getByTestId("agendar-visita");
      await expect(visita).toHaveText(/Agendar visita/);
      expect(await visita.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
      // A visita é opção: abre a própria janela e fecha sem mexer na solicitação.
      await visita.click();
      await expect(page.getByTestId("visita-presencial-passo")).toBeVisible();
      await page.getByTestId("visita-presencial-passo").click({ position: { x: 5, y: 5 } });
      await expect(page.getByTestId("visita-presencial-passo")).toHaveCount(0);
      // "Solicitar" abre o MESMO fluxo de candidatura (passo de revisão; o envio final é "Enviar candidatura").
      await escopo.getByRole("button", { name: "Solicitar", exact: true }).click();
      const passo = page.getByTestId("solicitacao-passo");
      await expect(passo).toBeVisible();
      await expect(passo.getByTestId("solicitacao-demo")).toBeVisible(); // ube-001 é exemplo: nada é enviado
      await expect(page.getByRole("button", { name: "Enviar candidatura" })).toHaveCount(0); // só no último passo
    });
  });
}

// ─────────────────────────── 2. Barra inferior por papel ───────────────────────────

async function abas(page: Page): Promise<{ nome: string; href: string | null }[]> {
  const barra = page.locator('nav[aria-label="Navegação principal"]');
  await expect(barra).toBeVisible();
  return barra.getByRole("link").evaluateAll((els) => els.map((e) => ({ nome: (e.textContent ?? "").trim(), href: e.getAttribute("href") })));
}

test.describe("T258 — barra inferior por papel (390 px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.describe("morador", () => {
    test.skip(!hasAccount("inquilino"), "sem a conta do inquilino");
    test.use({ storageState: authFile("inquilino") });
    test("Início · Buscar · Mensagens · Estadias · Perfil; cabeçalho com foto e 'Morador'", async ({ page }) => {
      // Rota só do morador: a casca acerta o modo (outra spec pode ter trocado o modo da conta).
      await page.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
      await expect(async () => {
        expect(await abas(page)).toEqual([
          { nome: "Início", href: "/dashboard" },
          { nome: "Buscar", href: "/buscar" },
          { nome: "Mensagens", href: "/dashboard/mensagens" },
          { nome: "Estadias", href: "/dashboard/locacoes" },
          { nome: "Perfil", href: "/dashboard/conta" },
        ]);
      }).toPass({ timeout: 20_000 });
      const papel = page.locator('[data-testid="papel-ativo"]').locator("visible=true").first();
      await expect(papel).toHaveAttribute("data-papel", "morador");
      await expect(papel).toContainText("Morador");
      const sombra = await page.locator('nav[aria-label="Navegação principal"]').evaluate((el) => getComputedStyle(el).boxShadow);
      expect(sombra).toBe(SOMBRA_FLUTUANTE);
      expect(await semRolagem(page)).toBeLessThanOrEqual(0);
    });
  });

  test.describe("proprietário", () => {
    test.skip(!hasAccount("proprietario"), "sem a conta do proprietário");
    test.use({ storageState: authFile("proprietario") });
    test("Início · Anúncios · Mensagens · Ganhos ('pago direto na sua conta') · Perfil", async ({ page }) => {
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(async () => {
        expect((await abas(page)).map((a) => a.nome)).toEqual(["Início", "Anúncios", "Mensagens", "Ganhos", "Perfil"]);
      }).toPass({ timeout: 20_000 });
      const ganhos = page.locator('nav[aria-label="Navegação principal"]').getByRole("link", { name: "Ganhos: pago direto na sua conta" });
      await expect(ganhos).toHaveAttribute("href", "/dashboard/contratos");
      await expect(page.locator('[data-testid="papel-ativo"]').locator("visible=true").first()).toHaveAttribute("data-papel", "proprietario");
    });
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "sem a conta do admin");
    test.use({ storageState: authFile("admin") });
    test("admin não tem barra inferior", async ({ page }) => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid="papel-ativo"]').locator("visible=true").first()).toHaveAttribute("data-papel", "admin");
      await expect(page.locator('nav[aria-label="Navegação principal"]')).toHaveCount(0);
      await expect(page.locator('nav[aria-label="Abas do app"]')).toHaveCount(0);
    });
  });

  test.describe("parceiro aprovado e troca de papel no Perfil (laboratório)", () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório (cria a conta e a parceria aprovada).");
    test.describe.configure({ mode: "serial" });
    const senha = novaSenha();
    const sufixo = novoSufixo();
    const conta = { email: `parceiro.t258.${sufixo}@lab.vivanomads.test`, nome: "Paula Parceira", role: "tenant" as const };
    const pedido = { email: `pedido.t258.${sufixo}@lab.vivanomads.test`, nome: "Pedro Pedido", role: "tenant" as const };
    const ids: { conta?: string; pedido?: string } = {};
    test.beforeAll(async () => {
      ids.conta = await criarConta(conta, senha);
      ids.pedido = await criarConta(pedido, senha);
      // A linha em `parceiros` nasce na aprovação: é ela que faz a parceria contar como aprovada.
      const { error } = await adm()
        .from("parceiros")
        .insert({ user_id: ids.conta, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: "Paula Parceira", slug: `paula-t258-${sufixo}`.toLowerCase().replace(/[^a-z0-9-]/g, "") });
      if (error) throw error;
    });
    test.afterAll(async () => {
      if (ids.conta) await adm().from("parceiros").delete().eq("user_id", ids.conta);
      await apagarContas([ids.conta, ids.pedido]);
    });

    test("no painel do parceiro: Início · Pedidos · Agenda · Ganhos · Perfil (âncoras do painel)", async ({ browser }) => {
      test.setTimeout(120_000);
      const page = await entrar(browser, conta.email, senha);
      await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(async () => {
        expect(await abas(page)).toEqual([
          { nome: "Início", href: "/dashboard" },
          { nome: "Pedidos", href: "/dashboard/parceiro#pedidos" },
          { nome: "Agenda", href: "/dashboard/parceiro#agenda" },
          { nome: "Ganhos", href: "/dashboard/parceiro#ganhos" },
          { nome: "Perfil", href: "/dashboard/conta" },
        ]);
      }).toPass({ timeout: 25_000 });
      for (const id of ["pedidos", "agenda", "ganhos"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
      await expect(page.locator('[data-testid="papel-ativo"]').locator("visible=true").first()).toHaveAttribute("data-papel", "parceiro");
      // Fora do painel do parceiro (sem a preferência ligada no Perfil), a barra volta ao modo da conta.
      await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await expect(async () => expect((await abas(page)).map((a) => a.nome)).toContain("Estadias")).toPass({ timeout: 20_000 });
      await page.context().close();
    });

    test("pedido de parceria sem aprovação: nunca a barra do parceiro", async ({ browser }) => {
      test.setTimeout(120_000);
      await adm().from("parceiro_solicitacoes").insert({ user_id: ids.pedido, email: pedido.email, nome: pedido.nome }).then(() => undefined, () => undefined);
      const page = await entrar(browser, pedido.email, senha);
      await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(async () => expect((await abas(page)).map((a) => a.nome)).toEqual(["Início", "Buscar", "Mensagens", "Estadias", "Perfil"])).toPass({ timeout: 20_000 });
      await page.context().close();
    });

    test("app: a troca de papel fica no Perfil (parceiro ⇄ proprietário ⇄ morador)", async ({ browser }) => {
      test.setTimeout(150_000);
      const page = await entrarNoApp(browser, conta.email, senha);
      const barra = page.locator('nav[aria-label="Abas do app"]');
      const nomes = () => barra.getByRole("link").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
      await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      await page.getByTestId("usar-como-parceiro").click();
      await expect(page).toHaveURL(/\/dashboard\/parceiro/);
      await expect.poll(nomes, { timeout: 20_000 }).toEqual(["Início", "Pedidos", "Agenda", "Ganhos", "Perfil"]);
      await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      await page.getByRole("radio", { name: /Propriet/ }).click();
      await expect(page).toHaveURL(/\/dashboard\/?$/);
      await expect.poll(nomes, { timeout: 20_000 }).toEqual(["Início", "Anúncios", "Mensagens", "Ganhos", "Perfil"]);
      await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      await page.getByRole("radio", { name: /Inquilino/ }).click();
      await expect.poll(nomes, { timeout: 20_000 }).toEqual(["Início", "Buscar", "Mensagens", "Estadias", "Perfil"]);
      await page.context().close();
    });
  });
});

/** Login num contexto de APP (user-agent do app Expo), 390 px. */
async function entrarNoApp(browser: Browser, email: string, senha: string): Promise<Page> {
  await liberarLimiteLogin(email);
  await liberarLimiteLoginIp();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) VivaNomadsApp/1.0 (expo)" });
  const page = await ctx.newPage();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"], input[type="email"]').first().fill(email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/(dashboard|buscar|app)/, { timeout: 20_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return page;
}

// ─────────────────────────── 3. Um primário por tela ───────────────────────────

/** Rotas logadas varridas (no máximo 1 primário visível por rota renderizada). */
const ROTAS_PRIMARIO: Record<"inquilino" | "proprietario" | "admin", string[]> = {
  inquilino: [
    "/dashboard",
    "/dashboard/candidaturas",
    "/dashboard/favoritos",
    "/dashboard/buscas",
    "/dashboard/comparar",
    "/dashboard/locacoes",
    "/dashboard/contratos",
    "/dashboard/propostas",
    "/dashboard/pedidos",
    "/dashboard/visitas",
    "/dashboard/solicitacoes",
    "/dashboard/servicos",
    "/dashboard/mensagens",
    "/dashboard/notificacoes",
    "/dashboard/verificacao",
    "/dashboard/avaliacoes",
    "/dashboard/indicacoes",
    "/dashboard/parceiro",
    "/dashboard/conta",
    "/dashboard/conta/seguranca",
  ],
  proprietario: [
    "/dashboard",
    "/dashboard/imoveis",
    "/dashboard/leads",
    "/dashboard/pedidos-cidade",
    "/dashboard/fechamento",
    "/dashboard/contratos",
    "/dashboard/garantias",
    "/dashboard/agenda",
    "/dashboard/carteira",
    "/dashboard/orcamentos",
    "/dashboard/reembolsos",
    "/dashboard/ferramentas",
    "/dashboard/simulador",
    "/dashboard/roi-imovel",
    "/dashboard/tributacao",
    "/dashboard/viabilidade",
    "/dashboard/assinatura",
    "/dashboard/solicitacoes",
    "/dashboard/imoveis/novo",
    "/qualificar",
    "/dashboard/conta",
  ],
  admin: [
    "/admin",
    "/admin/atendimento",
    "/admin/avaliacoes",
    "/admin/cidades",
    "/admin/contratos",
    "/admin/dados-de-teste",
    "/admin/documentos",
    "/admin/imoveis",
    "/admin/marketing",
    "/admin/parceiros",
    "/admin/pedidos",
    "/admin/servicos",
    "/admin/socios",
    "/admin/usuarios",
  ],
};

for (const largura of LARGURAS) {
  for (const papel of ["inquilino", "proprietario", "admin"] as const) {
    test.describe(`T258 — um primário por tela (${papel}, ${largura} px)`, () => {
      test.skip(!hasAccount(papel), `sem a conta ${papel}`);
      test.use({ storageState: authFile(papel), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      test.describe.configure({ timeout: 300_000 });
      test("no máximo 1 [data-cta=primary] visível por rota; destrutivo nunca é primário", async ({ page }) => {
        const excessos: string[] = [];
        for (const rota of ROTAS_PRIMARIO[papel]) {
          await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 60_000 });
          await page.locator("main, #main, body").first().waitFor({ state: "visible" });
          await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
          const lista = await primarios(page);
          if (lista.length > 1) excessos.push(`${rota} → ${page.url().replace(/^https?:\/\/[^/]+/, "")}: ${lista.join(" | ")}`);
          for (const t of lista) if (/excluir|apagar|remover|cancelar contrato/i.test(t)) excessos.push(`${rota}: destrutivo como primário ("${t}")`);
          const semMarca = await primariosSemMarca(page);
          if (semMarca.length) test.info().annotations.push({ type: "primario-sem-marca", description: `${rota}: ${semMarca.join(" | ")}` });
        }
        expect(excessos, "rotas com mais de um primário").toEqual([]);
      });
    });
  }
}

// ─────────────────────────── 4. Cogumelo (Ações desta estadia) ───────────────────────────

test.describe("T258 — cogumelo na estadia (laboratório)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (cria dono, morador, imóvel e um contrato vigente).");
  test.describe.configure({ mode: "serial" });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t258.${sufixo}@lab.vivanomads.test`, nome: "Dalva Cogumelo", role: "owner" as const };
  const inq = { email: `inq.t258.${sufixo}@lab.vivanomads.test`, nome: "Igor Cogumelo", role: "tenant" as const };
  const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};
  const PERMITIDAS = ["Falar com o proprietário", "Falar com o morador", "Ver o contrato", "Ver instruções de chegada", "Pedir manutenção"];

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Cogumelo t258 ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
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
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono);
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const [quem, rota, falar] of [
    ["morador", () => `/dashboard/locacoes/${ids.contrato}`, "Falar com o proprietário"],
    ["proprietário", () => `/dashboard/contratos/${ids.contrato}`, "Falar com o morador"],
  ] as const) {
    for (const largura of LARGURAS) {
      test(`${quem} a ${largura} px: folha só com ações que existem; sombra única; não cobre o Fale com a Viva`, async ({ browser }) => {
        test.setTimeout(150_000);
        const page = await entrar(browser, quem === "morador" ? inq.email : dono.email, senha);
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        // Fora da estadia, nada de cogumelo.
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("cogumelo")).toHaveCount(0);
        await page.goto(rota(), { waitUntil: "domcontentloaded" });
        const cog = page.getByTestId("cogumelo");
        await expect(cog).toBeVisible({ timeout: 25_000 });
        expect(await cog.evaluate((el) => getComputedStyle(el).boxShadow)).toBe(SOMBRA_FLUTUANTE);
        // Não cobre o "Fale com a Viva" (o Viva sobe acima dele).
        const viva = page.getByTestId("fale-com-a-viva");
        if (await viva.isVisible()) {
          const a = (await cog.boundingBox())!;
          const b = (await viva.boundingBox())!;
          const cruza = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
          expect(cruza, "cogumelo e Fale com a Viva se sobrepõem").toBe(false);
        }
        await cog.click();
        const folha = page.getByRole("dialog", { name: "Ações desta estadia" });
        await expect(folha).toBeVisible();
        const itens = (await folha.getByTestId("acoes-estadia-lista").locator("li").allInnerTexts()).map((t) => t.trim());
        expect(itens).toContain(falar);
        expect(itens).toContain("Ver o contrato");
        for (const t of itens) {
          expect(PERMITIDAS, t).toContain(t);
          expect(t).not.toMatch(/cancelar|avaliar|pagar/i);
        }
        if (quem === "proprietário") expect(itens).not.toContain("Pedir manutenção");
        await folha.getByRole("link", { name: "Ver o contrato" }).click();
        await expect(folha).toHaveCount(0);
        await expect(page.locator("#contrato")).toBeInViewport();
        await page.screenshot({ path: `tests/laboratorio/saida/t258-cogumelo-${quem === "morador" ? "morador" : "dono"}-${largura}.png` });
        await page.context().close();
      });
    }
  }
});
