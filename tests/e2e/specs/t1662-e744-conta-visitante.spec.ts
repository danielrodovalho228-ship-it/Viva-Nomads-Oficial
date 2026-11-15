import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ENDERECOS_DA_CONTA, SECAO_INEXISTENTE } from "../fixtures/enderecos-da-conta";

/*
  T1662 — E744 (passo 10): o visitante que abre um endereço da Conta sem estar logado.
  O t1660 cobra os endereços com a pessoa logada; aqui, sem sessão:
   1. cada endereço manda ao login guardando o destino (F11: "voltar exatamente onde estava") — o próprio endereço,
      ou a tela para onde ele leva (Avaliações, Notificações), com a consulta junto;
   2. depois de entrar, a pessoa cai na tela pedida: tela própria, tela para onde o endereço leva e /dashboard/conta
      (Perfil no computador, menu no celular — E492).
  Fora daqui, de propósito: a âncora antiga (/dashboard/conta#documento) aberta sem sessão. Hoje ela se perde no login
  (a pessoa cai no Perfil ou no menu, não em Dados); o destino guardado é caminho + consulta (F11) e não há regra
  registrada sobre a âncora, então o caso ficou como dúvida no PR, sem asserção.
*/
const senha = novaSenha();
const conta = { email: `conta.t1662.${novoSufixo()}@lab.vivanomads.test`, nome: "Vera Visitante", role: "tenant" as const };
let id: string | undefined;

const LARGURAS = [
  { largura: 1280, altura: 900 },
  { largura: 390, altura: 844 },
] as const;

/** Página de um visitante: contexto novo, sem cookie nenhum. */
async function visitante(browser: Browser, t: (typeof LARGURAS)[number]): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: t.largura, height: t.altura }, storageState: { cookies: [], origins: [] } });
  return ctx.newPage();
}
const endereco = (page: Page, comAncora = false) => {
  const u = new URL(page.url());
  return `${u.pathname}${u.search}${comAncora ? u.hash : ""}`;
};
/** O destino guardado pelo login (parâmetro redirect), já decodificado. */
const destinoGuardado = (page: Page) => new URL(page.url()).searchParams.get("redirect");

/** Entra com senha na tela de login em que o visitante caiu, mantendo o destino guardado e a âncora. */
async function entrarDaqui(page: Page) {
  await liberarLimiteLogin(conta.email);
  await liberarLimiteLoginIp();
  const u = new URL(page.url());
  expect(u.pathname, "o visitante está na tela de login").toBe("/auth");
  u.searchParams.set("senha", "1");
  await page.goto(`${u.pathname}${u.search}${u.hash}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  // Um clique antes da hidratação vira envio nativo e recarrega a tela: repete até sair do login (como entrarNaPagina).
  await expect(async () => {
    if (new URL(page.url()).pathname !== "/auth") return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== conta.email) await campoEmail.fill(conta.email, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL((url) => url.pathname !== "/auth", { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
}

const suave = expect.configure({ soft: true });

test.describe("T1662 — E744: endereços da Conta sem sessão", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const t of LARGURAS) {
    test(`${t.largura} px: cada endereço da Conta manda o visitante ao login com o destino guardado`, async ({ browser }) => {
      test.setTimeout(180_000);
      const page = await visitante(browser, t);
      const casos = [
        { rota: "/dashboard/conta", destino: "/dashboard/conta" },
        ...ENDERECOS_DA_CONTA.map((e) => ({ rota: e.rota, destino: e.destino })),
        { rota: SECAO_INEXISTENTE, destino: SECAO_INEXISTENTE },
        // A consulta vai junto (o portão do admin manda ativar as duas etapas com ?obrigatorio=admin&redirect=/admin).
        { rota: "/dashboard/conta/seguranca?obrigatorio=admin&redirect=%2Fadmin", destino: "/dashboard/conta/seguranca?obrigatorio=admin&redirect=%2Fadmin" },
      ];
      for (const c of casos) {
        await test.step(c.rota, async () => {
          await page.goto(c.rota, { waitUntil: "domcontentloaded" });
          await suave.poll(() => new URL(page.url()).pathname, { message: `${c.rota}: vai ao login`, timeout: 15_000 }).toBe("/auth");
          suave(destinoGuardado(page), `${c.rota}: destino guardado`).toBe(c.destino);
        });
      }
      await suave(page.getByRole("heading", { level: 1, name: "Entre ou crie sua conta" }), "a tela de login abriu").toBeVisible();
      await page.context().close();
    });

    const voltas = [
      { nome: "tela própria", rota: "/dashboard/conta/pagamentos", destino: "/dashboard/conta/pagamentos", h1: "Pagamentos" },
      { nome: "endereço que leva a outra tela", rota: "/dashboard/conta/avaliacoes", destino: "/dashboard/avaliacoes?aba=recebidas", h1: "Avaliações" },
      t.largura >= 1024
        ? { nome: "/dashboard/conta no computador (E492)", rota: "/dashboard/conta", destino: "/dashboard/conta/perfil", h1: "Perfil" }
        : { nome: "/dashboard/conta no celular (E492)", rota: "/dashboard/conta", destino: "/dashboard/conta", h1: "Conta" },
    ];
    for (const v of voltas) {
      test(`${t.largura} px: depois de entrar, o visitante cai na tela pedida — ${v.nome}`, async ({ browser }) => {
        test.setTimeout(120_000);
        const page = await visitante(browser, t);
        await page.goto(v.rota, { waitUntil: "domcontentloaded" });
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/auth");
        await entrarDaqui(page);
        await expect.poll(() => endereco(page, v.destino.includes("#")), { message: `${v.rota}: tela em que a pessoa cai depois de entrar`, timeout: 30_000 }).toBe(v.destino);
        await expect(page.locator("h1:visible")).toHaveText([v.h1], { timeout: 20_000 });
        await page.context().close();
      });
    }
  }
});
